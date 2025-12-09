"""Project Management API endpoints."""

import json
import os
import uuid
from datetime import datetime
from typing import List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()

# Store projects in data directory
DATA_DIR = os.getenv("DATA_DIR", "./data")
PROJECTS_FILE = os.path.join(DATA_DIR, "projects.json")


class Task(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str = ""
    status: Literal["todo", "in_progress", "done", "blocked"] = "todo"
    priority: Literal["low", "medium", "high", "critical"] = "medium"
    dependencies: List[str] = Field(default_factory=list)
    assignee: Optional[str] = None
    due_date: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    completed_at: Optional[str] = None


class Project(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    status: Literal["planning", "active", "paused", "completed", "archived"] = "planning"
    tasks: List[Task] = Field(default_factory=list)
    knowledge_ids: List[str] = Field(default_factory=list)
    conversation_ids: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class CreateProjectRequest(BaseModel):
    name: str
    description: str = ""
    tags: List[str] = Field(default_factory=list)


class UpdateProjectRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[Literal["planning", "active", "paused", "completed", "archived"]] = None
    tags: Optional[List[str]] = None


class CreateTaskRequest(BaseModel):
    title: str
    description: str = ""
    priority: Literal["low", "medium", "high", "critical"] = "medium"
    dependencies: List[str] = Field(default_factory=list)
    assignee: Optional[str] = None
    due_date: Optional[str] = None


class UpdateTaskRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[Literal["todo", "in_progress", "done", "blocked"]] = None
    priority: Optional[Literal["low", "medium", "high", "critical"]] = None
    dependencies: Optional[List[str]] = None
    assignee: Optional[str] = None
    due_date: Optional[str] = None


def load_projects() -> List[Project]:
    """Load projects from file."""
    if not os.path.exists(PROJECTS_FILE):
        return []
    try:
        with open(PROJECTS_FILE, "r") as f:
            data = json.load(f)
            return [Project(**p) for p in data]
    except (json.JSONDecodeError, FileNotFoundError):
        return []


def save_projects(projects: List[Project]):
    """Save projects to file."""
    os.makedirs(os.path.dirname(PROJECTS_FILE), exist_ok=True)
    with open(PROJECTS_FILE, "w") as f:
        json.dump([p.model_dump() for p in projects], f, indent=2)


@router.get("")
async def list_projects(
    status: Optional[str] = None,
    tag: Optional[str] = None
) -> List[Project]:
    """List all projects with optional filtering."""
    projects = load_projects()

    if status:
        projects = [p for p in projects if p.status == status]
    if tag:
        projects = [p for p in projects if tag in p.tags]

    return sorted(projects, key=lambda p: p.updated_at, reverse=True)


@router.post("")
async def create_project(request: CreateProjectRequest) -> Project:
    """Create a new project."""
    projects = load_projects()

    project = Project(
        name=request.name,
        description=request.description,
        tags=request.tags
    )

    projects.append(project)
    save_projects(projects)

    return project


@router.get("/{project_id}")
async def get_project(project_id: str) -> Project:
    """Get a project by ID."""
    projects = load_projects()

    for project in projects:
        if project.id == project_id:
            return project

    raise HTTPException(status_code=404, detail="Project not found")


@router.patch("/{project_id}")
async def update_project(project_id: str, request: UpdateProjectRequest) -> Project:
    """Update a project."""
    projects = load_projects()

    for i, project in enumerate(projects):
        if project.id == project_id:
            update_data = request.model_dump(exclude_none=True)
            update_data["updated_at"] = datetime.utcnow().isoformat()

            updated = project.model_copy(update=update_data)
            projects[i] = updated
            save_projects(projects)
            return updated

    raise HTTPException(status_code=404, detail="Project not found")


@router.delete("/{project_id}")
async def delete_project(project_id: str):
    """Delete a project."""
    projects = load_projects()

    for i, project in enumerate(projects):
        if project.id == project_id:
            projects.pop(i)
            save_projects(projects)
            return {"status": "deleted", "id": project_id}

    raise HTTPException(status_code=404, detail="Project not found")


# Task endpoints

@router.post("/{project_id}/tasks")
async def create_task(project_id: str, request: CreateTaskRequest) -> Task:
    """Create a task in a project."""
    projects = load_projects()

    for i, project in enumerate(projects):
        if project.id == project_id:
            task = Task(
                title=request.title,
                description=request.description,
                priority=request.priority,
                dependencies=request.dependencies,
                assignee=request.assignee,
                due_date=request.due_date
            )

            project.tasks.append(task)
            project.updated_at = datetime.utcnow().isoformat()
            projects[i] = project
            save_projects(projects)
            return task

    raise HTTPException(status_code=404, detail="Project not found")


@router.get("/{project_id}/tasks")
async def list_tasks(
    project_id: str,
    status: Optional[str] = None
) -> List[Task]:
    """List tasks in a project."""
    projects = load_projects()

    for project in projects:
        if project.id == project_id:
            tasks = project.tasks
            if status:
                tasks = [t for t in tasks if t.status == status]
            return tasks

    raise HTTPException(status_code=404, detail="Project not found")


@router.patch("/{project_id}/tasks/{task_id}")
async def update_task(
    project_id: str,
    task_id: str,
    request: UpdateTaskRequest
) -> Task:
    """Update a task."""
    projects = load_projects()

    for i, project in enumerate(projects):
        if project.id == project_id:
            for j, task in enumerate(project.tasks):
                if task.id == task_id:
                    update_data = request.model_dump(exclude_none=True)
                    update_data["updated_at"] = datetime.utcnow().isoformat()

                    # Set completed_at if marking as done
                    if request.status == "done" and task.status != "done":
                        update_data["completed_at"] = datetime.utcnow().isoformat()

                    updated = task.model_copy(update=update_data)
                    project.tasks[j] = updated
                    project.updated_at = datetime.utcnow().isoformat()
                    projects[i] = project
                    save_projects(projects)
                    return updated

            raise HTTPException(status_code=404, detail="Task not found")

    raise HTTPException(status_code=404, detail="Project not found")


@router.delete("/{project_id}/tasks/{task_id}")
async def delete_task(project_id: str, task_id: str):
    """Delete a task from a project."""
    projects = load_projects()

    for i, project in enumerate(projects):
        if project.id == project_id:
            for j, task in enumerate(project.tasks):
                if task.id == task_id:
                    project.tasks.pop(j)
                    project.updated_at = datetime.utcnow().isoformat()
                    projects[i] = project
                    save_projects(projects)
                    return {"status": "deleted", "id": task_id}

            raise HTTPException(status_code=404, detail="Task not found")

    raise HTTPException(status_code=404, detail="Project not found")


# Link resources to project

@router.post("/{project_id}/link/knowledge/{knowledge_id}")
async def link_knowledge(project_id: str, knowledge_id: str) -> Project:
    """Link a knowledge base collection to a project."""
    projects = load_projects()

    for i, project in enumerate(projects):
        if project.id == project_id:
            if knowledge_id not in project.knowledge_ids:
                project.knowledge_ids.append(knowledge_id)
                project.updated_at = datetime.utcnow().isoformat()
                projects[i] = project
                save_projects(projects)
            return project

    raise HTTPException(status_code=404, detail="Project not found")


@router.delete("/{project_id}/link/knowledge/{knowledge_id}")
async def unlink_knowledge(project_id: str, knowledge_id: str) -> Project:
    """Unlink a knowledge base collection from a project."""
    projects = load_projects()

    for i, project in enumerate(projects):
        if project.id == project_id:
            if knowledge_id in project.knowledge_ids:
                project.knowledge_ids.remove(knowledge_id)
                project.updated_at = datetime.utcnow().isoformat()
                projects[i] = project
                save_projects(projects)
            return project

    raise HTTPException(status_code=404, detail="Project not found")


@router.post("/{project_id}/link/conversation/{conversation_id}")
async def link_conversation(project_id: str, conversation_id: str) -> Project:
    """Link a conversation to a project."""
    projects = load_projects()

    for i, project in enumerate(projects):
        if project.id == project_id:
            if conversation_id not in project.conversation_ids:
                project.conversation_ids.append(conversation_id)
                project.updated_at = datetime.utcnow().isoformat()
                projects[i] = project
                save_projects(projects)
            return project

    raise HTTPException(status_code=404, detail="Project not found")


@router.delete("/{project_id}/link/conversation/{conversation_id}")
async def unlink_conversation(project_id: str, conversation_id: str) -> Project:
    """Unlink a conversation from a project."""
    projects = load_projects()

    for i, project in enumerate(projects):
        if project.id == project_id:
            if conversation_id in project.conversation_ids:
                project.conversation_ids.remove(conversation_id)
                project.updated_at = datetime.utcnow().isoformat()
                projects[i] = project
                save_projects(projects)
            return project

    raise HTTPException(status_code=404, detail="Project not found")


@router.get("/{project_id}/stats")
async def get_project_stats(project_id: str):
    """Get project statistics."""
    projects = load_projects()

    for project in projects:
        if project.id == project_id:
            total_tasks = len(project.tasks)
            done_tasks = len([t for t in project.tasks if t.status == "done"])
            in_progress = len([t for t in project.tasks if t.status == "in_progress"])
            blocked = len([t for t in project.tasks if t.status == "blocked"])

            return {
                "total_tasks": total_tasks,
                "completed_tasks": done_tasks,
                "in_progress_tasks": in_progress,
                "blocked_tasks": blocked,
                "completion_percentage": round((done_tasks / total_tasks * 100) if total_tasks > 0 else 0, 1),
                "linked_knowledge": len(project.knowledge_ids),
                "linked_conversations": len(project.conversation_ids)
            }

    raise HTTPException(status_code=404, detail="Project not found")


@router.get("/{project_id}/export")
async def export_project(project_id: str):
    """Export project data as JSON."""
    projects = load_projects()

    for project in projects:
        if project.id == project_id:
            return {
                "project": project.model_dump(),
                "exported_at": datetime.utcnow().isoformat()
            }

    raise HTTPException(status_code=404, detail="Project not found")
