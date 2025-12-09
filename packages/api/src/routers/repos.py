"""Repository Analysis API endpoints."""

import json
import os
import shutil
import subprocess
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()

# Store repos in data directory
DATA_DIR = os.getenv("DATA_DIR", "./data")
REPOS_DIR = os.path.join(DATA_DIR, "repos")
REPOS_FILE = os.path.join(DATA_DIR, "repos_index.json")


class FileInfo(BaseModel):
    path: str
    name: str
    type: Literal["file", "directory"]
    size: int = 0
    extension: str = ""
    language: str = ""


class RepoStats(BaseModel):
    total_files: int = 0
    total_directories: int = 0
    total_lines: int = 0
    languages: dict = Field(default_factory=dict)
    largest_files: List[dict] = Field(default_factory=list)


class Repository(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    url: Optional[str] = None
    local_path: Optional[str] = None
    description: str = ""
    branch: str = "main"
    last_commit: Optional[str] = None
    last_commit_date: Optional[str] = None
    stats: Optional[RepoStats] = None
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    status: Literal["cloning", "ready", "error", "analyzing"] = "ready"
    error: Optional[str] = None


class CloneRepoRequest(BaseModel):
    url: str
    name: Optional[str] = None
    branch: str = "main"


class AddLocalRepoRequest(BaseModel):
    path: str
    name: Optional[str] = None


# Language detection by extension
LANGUAGE_MAP = {
    ".py": "Python",
    ".js": "JavaScript",
    ".ts": "TypeScript",
    ".jsx": "JavaScript (React)",
    ".tsx": "TypeScript (React)",
    ".svelte": "Svelte",
    ".vue": "Vue",
    ".html": "HTML",
    ".css": "CSS",
    ".scss": "SCSS",
    ".sass": "Sass",
    ".less": "Less",
    ".json": "JSON",
    ".yaml": "YAML",
    ".yml": "YAML",
    ".md": "Markdown",
    ".rs": "Rust",
    ".go": "Go",
    ".java": "Java",
    ".kt": "Kotlin",
    ".swift": "Swift",
    ".c": "C",
    ".cpp": "C++",
    ".h": "C Header",
    ".hpp": "C++ Header",
    ".cs": "C#",
    ".rb": "Ruby",
    ".php": "PHP",
    ".sh": "Shell",
    ".bash": "Bash",
    ".zsh": "Zsh",
    ".sql": "SQL",
    ".graphql": "GraphQL",
    ".proto": "Protocol Buffers",
    ".toml": "TOML",
    ".xml": "XML",
    ".dockerfile": "Dockerfile",
}


def load_repos() -> List[Repository]:
    """Load repository index from file."""
    if not os.path.exists(REPOS_FILE):
        return []
    try:
        with open(REPOS_FILE, "r") as f:
            data = json.load(f)
            return [Repository(**r) for r in data]
    except (json.JSONDecodeError, FileNotFoundError):
        return []


def save_repos(repos: List[Repository]):
    """Save repository index to file."""
    os.makedirs(os.path.dirname(REPOS_FILE), exist_ok=True)
    with open(REPOS_FILE, "w") as f:
        json.dump([r.model_dump() for r in repos], f, indent=2)


def get_language(extension: str) -> str:
    """Get language from file extension."""
    return LANGUAGE_MAP.get(extension.lower(), "")


def analyze_directory(path: str, max_depth: int = 10) -> RepoStats:
    """Analyze a directory and return statistics."""
    stats = RepoStats()
    languages = {}
    largest_files = []

    def scan_dir(dir_path: str, depth: int = 0):
        if depth > max_depth:
            return

        try:
            for entry in os.scandir(dir_path):
                # Skip hidden files and common non-code directories
                if entry.name.startswith('.') or entry.name in ['node_modules', 'venv', '__pycache__', 'dist', 'build', '.git']:
                    continue

                if entry.is_file():
                    stats.total_files += 1
                    ext = os.path.splitext(entry.name)[1]
                    lang = get_language(ext)

                    if lang:
                        languages[lang] = languages.get(lang, 0) + 1

                    try:
                        size = entry.stat().st_size
                        largest_files.append({
                            "path": os.path.relpath(entry.path, path),
                            "size": size,
                            "language": lang
                        })

                        # Count lines for text files
                        if size < 1_000_000 and ext in LANGUAGE_MAP:  # < 1MB
                            try:
                                with open(entry.path, 'r', encoding='utf-8', errors='ignore') as f:
                                    stats.total_lines += sum(1 for _ in f)
                            except:
                                pass
                    except:
                        pass

                elif entry.is_dir():
                    stats.total_directories += 1
                    scan_dir(entry.path, depth + 1)
        except PermissionError:
            pass

    scan_dir(path)

    # Sort and limit largest files
    largest_files.sort(key=lambda x: x["size"], reverse=True)
    stats.largest_files = largest_files[:10]
    stats.languages = languages

    return stats


def get_git_info(repo_path: str) -> dict:
    """Get git information from repository."""
    info = {}

    try:
        # Get last commit hash
        result = subprocess.run(
            ["git", "log", "-1", "--format=%H"],
            cwd=repo_path,
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            info["last_commit"] = result.stdout.strip()

        # Get last commit date
        result = subprocess.run(
            ["git", "log", "-1", "--format=%ci"],
            cwd=repo_path,
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            info["last_commit_date"] = result.stdout.strip()

        # Get current branch
        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=repo_path,
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            info["branch"] = result.stdout.strip()

    except Exception:
        pass

    return info


@router.get("")
async def list_repos() -> List[Repository]:
    """List all repositories."""
    return load_repos()


@router.post("/clone")
async def clone_repo(request: CloneRepoRequest) -> Repository:
    """Clone a git repository."""
    repos = load_repos()

    # Extract repo name from URL if not provided
    name = request.name
    if not name:
        name = request.url.split("/")[-1].replace(".git", "")

    # Check if already exists
    for repo in repos:
        if repo.url == request.url:
            raise HTTPException(status_code=400, detail="Repository already exists")

    repo_id = str(uuid.uuid4())
    clone_path = os.path.join(REPOS_DIR, repo_id)

    repo = Repository(
        id=repo_id,
        name=name,
        url=request.url,
        local_path=clone_path,
        branch=request.branch,
        status="cloning"
    )

    repos.append(repo)
    save_repos(repos)

    try:
        os.makedirs(REPOS_DIR, exist_ok=True)

        # Clone the repository
        result = subprocess.run(
            ["git", "clone", "--branch", request.branch, "--depth", "1", request.url, clone_path],
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )

        if result.returncode != 0:
            raise Exception(result.stderr)

        # Update with git info and stats
        git_info = get_git_info(clone_path)
        stats = analyze_directory(clone_path)

        for i, r in enumerate(repos):
            if r.id == repo_id:
                repos[i] = repo.model_copy(update={
                    "status": "ready",
                    "stats": stats,
                    **git_info,
                    "updated_at": datetime.utcnow().isoformat()
                })
                repo = repos[i]
                break

        save_repos(repos)
        return repo

    except Exception as e:
        # Update status to error
        for i, r in enumerate(repos):
            if r.id == repo_id:
                repos[i] = r.model_copy(update={
                    "status": "error",
                    "error": str(e),
                    "updated_at": datetime.utcnow().isoformat()
                })
                repo = repos[i]
                break
        save_repos(repos)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/local")
async def add_local_repo(request: AddLocalRepoRequest) -> Repository:
    """Add a local repository."""
    repos = load_repos()

    if not os.path.exists(request.path):
        raise HTTPException(status_code=404, detail="Path does not exist")

    if not os.path.isdir(request.path):
        raise HTTPException(status_code=400, detail="Path is not a directory")

    # Check if already exists
    for repo in repos:
        if repo.local_path == request.path:
            raise HTTPException(status_code=400, detail="Repository already exists")

    name = request.name or os.path.basename(request.path)

    # Get git info if it's a git repo
    git_info = get_git_info(request.path)
    is_git = bool(git_info.get("last_commit"))

    repo = Repository(
        name=name,
        local_path=request.path,
        description="Local repository" + (" (Git)" if is_git else ""),
        **git_info
    )

    # Analyze directory
    repo.stats = analyze_directory(request.path)

    repos.append(repo)
    save_repos(repos)

    return repo


@router.get("/{repo_id}")
async def get_repo(repo_id: str) -> Repository:
    """Get repository details."""
    repos = load_repos()

    for repo in repos:
        if repo.id == repo_id:
            return repo

    raise HTTPException(status_code=404, detail="Repository not found")


@router.post("/{repo_id}/analyze")
async def analyze_repo(repo_id: str) -> Repository:
    """Re-analyze a repository."""
    repos = load_repos()

    for i, repo in enumerate(repos):
        if repo.id == repo_id:
            if not repo.local_path or not os.path.exists(repo.local_path):
                raise HTTPException(status_code=400, detail="Repository path not found")

            repos[i] = repo.model_copy(update={
                "status": "analyzing",
                "updated_at": datetime.utcnow().isoformat()
            })
            save_repos(repos)

            # Analyze
            stats = analyze_directory(repo.local_path)
            git_info = get_git_info(repo.local_path)

            repos[i] = repo.model_copy(update={
                "status": "ready",
                "stats": stats,
                **git_info,
                "updated_at": datetime.utcnow().isoformat()
            })
            save_repos(repos)
            return repos[i]

    raise HTTPException(status_code=404, detail="Repository not found")


@router.delete("/{repo_id}")
async def delete_repo(repo_id: str):
    """Delete a repository."""
    repos = load_repos()

    for i, repo in enumerate(repos):
        if repo.id == repo_id:
            # Only delete cloned repos, not local references
            if repo.url and repo.local_path and os.path.exists(repo.local_path):
                if repo.local_path.startswith(REPOS_DIR):
                    shutil.rmtree(repo.local_path, ignore_errors=True)

            repos.pop(i)
            save_repos(repos)
            return {"status": "deleted", "id": repo_id}

    raise HTTPException(status_code=404, detail="Repository not found")


@router.get("/{repo_id}/files")
async def list_files(
    repo_id: str,
    path: str = "",
    max_depth: int = 2
) -> List[FileInfo]:
    """List files in a repository directory."""
    repos = load_repos()

    for repo in repos:
        if repo.id == repo_id:
            if not repo.local_path or not os.path.exists(repo.local_path):
                raise HTTPException(status_code=400, detail="Repository path not found")

            target_path = os.path.join(repo.local_path, path)
            if not os.path.exists(target_path):
                raise HTTPException(status_code=404, detail="Path not found")

            files = []

            def scan(dir_path: str, relative_base: str, depth: int = 0):
                if depth > max_depth:
                    return

                try:
                    entries = list(os.scandir(dir_path))
                    entries.sort(key=lambda x: (not x.is_dir(), x.name.lower()))

                    for entry in entries:
                        if entry.name.startswith('.') or entry.name in ['node_modules', '__pycache__']:
                            continue

                        rel_path = os.path.join(relative_base, entry.name) if relative_base else entry.name
                        ext = os.path.splitext(entry.name)[1] if entry.is_file() else ""

                        file_info = FileInfo(
                            path=rel_path,
                            name=entry.name,
                            type="directory" if entry.is_dir() else "file",
                            size=entry.stat().st_size if entry.is_file() else 0,
                            extension=ext,
                            language=get_language(ext)
                        )
                        files.append(file_info)

                        if entry.is_dir() and depth < max_depth:
                            scan(entry.path, rel_path, depth + 1)
                except PermissionError:
                    pass

            scan(target_path, path)
            return files

    raise HTTPException(status_code=404, detail="Repository not found")


@router.get("/{repo_id}/file")
async def get_file_content(repo_id: str, path: str) -> dict:
    """Get contents of a specific file."""
    repos = load_repos()

    for repo in repos:
        if repo.id == repo_id:
            if not repo.local_path or not os.path.exists(repo.local_path):
                raise HTTPException(status_code=400, detail="Repository path not found")

            file_path = os.path.join(repo.local_path, path)
            if not os.path.exists(file_path):
                raise HTTPException(status_code=404, detail="File not found")

            if not os.path.isfile(file_path):
                raise HTTPException(status_code=400, detail="Path is not a file")

            # Check file size (limit to 1MB)
            if os.path.getsize(file_path) > 1_000_000:
                raise HTTPException(status_code=400, detail="File too large (max 1MB)")

            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()

                ext = os.path.splitext(path)[1]
                return {
                    "path": path,
                    "content": content,
                    "language": get_language(ext),
                    "size": len(content),
                    "lines": content.count('\n') + 1
                }
            except UnicodeDecodeError:
                raise HTTPException(status_code=400, detail="File is not a text file")

    raise HTTPException(status_code=404, detail="Repository not found")


@router.get("/{repo_id}/search")
async def search_files(
    repo_id: str,
    query: str,
    file_pattern: str = "*"
) -> List[dict]:
    """Search for text in repository files."""
    repos = load_repos()

    for repo in repos:
        if repo.id == repo_id:
            if not repo.local_path or not os.path.exists(repo.local_path):
                raise HTTPException(status_code=400, detail="Repository path not found")

            results = []
            query_lower = query.lower()

            def search_dir(dir_path: str, depth: int = 0):
                if depth > 10 or len(results) >= 100:  # Limit results
                    return

                try:
                    for entry in os.scandir(dir_path):
                        if entry.name.startswith('.') or entry.name in ['node_modules', '__pycache__', 'dist', 'build']:
                            continue

                        if entry.is_file():
                            ext = os.path.splitext(entry.name)[1]
                            if ext not in LANGUAGE_MAP:
                                continue

                            # Check file size (limit to 500KB)
                            if entry.stat().st_size > 500_000:
                                continue

                            try:
                                with open(entry.path, 'r', encoding='utf-8', errors='ignore') as f:
                                    for line_num, line in enumerate(f, 1):
                                        if query_lower in line.lower():
                                            results.append({
                                                "path": os.path.relpath(entry.path, repo.local_path),
                                                "line": line_num,
                                                "content": line.strip()[:200],
                                                "language": get_language(ext)
                                            })
                                            if len(results) >= 100:
                                                return
                            except:
                                pass

                        elif entry.is_dir():
                            search_dir(entry.path, depth + 1)
                except PermissionError:
                    pass

            search_dir(repo.local_path)
            return results

    raise HTTPException(status_code=404, detail="Repository not found")
