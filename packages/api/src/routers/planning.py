"""AI-Assisted Planning API - Generate project plans with AI."""

import json
import os
from typing import List, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")


class PlanTask(BaseModel):
    title: str
    description: str = ""
    priority: str = "medium"
    dependencies: List[str] = Field(default_factory=list)
    estimated_effort: str = ""  # e.g., "small", "medium", "large"


class GeneratedPlan(BaseModel):
    project_name: str
    description: str
    tasks: List[PlanTask]
    suggested_milestones: List[str] = Field(default_factory=list)
    risks: List[str] = Field(default_factory=list)
    success_criteria: List[str] = Field(default_factory=list)


class GeneratePlanRequest(BaseModel):
    description: str
    model: str = "llama3.2"
    context: Optional[str] = None
    existing_tasks: List[str] = Field(default_factory=list)
    max_tasks: int = 10


class RefineTaskRequest(BaseModel):
    task: str
    model: str = "llama3.2"
    context: Optional[str] = None


class AnalyzeProjectRequest(BaseModel):
    project_description: str
    tasks: List[dict]
    model: str = "llama3.2"


PLAN_GENERATION_PROMPT = """You are a project planning assistant. Given a project description, generate a structured plan with tasks.

Project Description:
{description}

{context_section}

{existing_tasks_section}

Generate a project plan in the following JSON format:
{{
    "project_name": "Brief project name",
    "description": "Refined project description",
    "tasks": [
        {{
            "title": "Task title",
            "description": "Detailed task description",
            "priority": "low|medium|high|critical",
            "dependencies": ["titles of tasks this depends on"],
            "estimated_effort": "small|medium|large"
        }}
    ],
    "suggested_milestones": ["Milestone 1", "Milestone 2"],
    "risks": ["Potential risk 1", "Potential risk 2"],
    "success_criteria": ["Criterion 1", "Criterion 2"]
}}

Generate up to {max_tasks} well-defined tasks. Tasks should be actionable and specific.
Return ONLY the JSON, no other text."""


TASK_REFINEMENT_PROMPT = """You are a task refinement assistant. Given a task, break it down into subtasks and provide more details.

Task: {task}

{context_section}

Generate a refined breakdown in the following JSON format:
{{
    "original_task": "Original task name",
    "refined_title": "More specific task title",
    "description": "Detailed description of what this task involves",
    "subtasks": [
        {{
            "title": "Subtask title",
            "description": "Subtask description",
            "effort": "small|medium|large"
        }}
    ],
    "acceptance_criteria": ["Criterion 1", "Criterion 2"],
    "potential_blockers": ["Blocker 1", "Blocker 2"],
    "suggested_approach": "Brief description of recommended approach"
}}

Return ONLY the JSON, no other text."""


PROJECT_ANALYSIS_PROMPT = """You are a project analyst. Analyze the following project and its tasks to identify issues and recommendations.

Project Description:
{project_description}

Current Tasks:
{tasks_json}

Analyze the project and provide insights in the following JSON format:
{{
    "health_score": 0.0-1.0,
    "completeness": {{
        "score": 0.0-1.0,
        "missing_areas": ["Area 1", "Area 2"]
    }},
    "task_quality": {{
        "score": 0.0-1.0,
        "issues": ["Issue 1", "Issue 2"]
    }},
    "dependency_analysis": {{
        "has_cycles": false,
        "bottleneck_tasks": ["Task that many depend on"],
        "isolated_tasks": ["Task with no dependencies or dependents"]
    }},
    "recommendations": [
        {{
            "type": "add_task|modify_task|remove_task|reorder|general",
            "description": "What to do",
            "priority": "low|medium|high"
        }}
    ],
    "risk_assessment": {{
        "overall_risk": "low|medium|high",
        "risks": ["Risk 1", "Risk 2"]
    }}
}}

Return ONLY the JSON, no other text."""


async def call_model(model: str, prompt: str) -> str:
    """Call the model and get response."""
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{OLLAMA_HOST}/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json"
                }
            )

            if response.status_code == 200:
                data = response.json()
                return data.get("response", "")
            else:
                raise HTTPException(
                    status_code=500,
                    detail=f"Model API error: {response.status_code}"
                )

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Model request timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate")
async def generate_plan(request: GeneratePlanRequest) -> GeneratedPlan:
    """Generate a project plan from a description."""
    context_section = ""
    if request.context:
        context_section = f"\nAdditional Context:\n{request.context}\n"

    existing_tasks_section = ""
    if request.existing_tasks:
        tasks_str = "\n".join(f"- {t}" for t in request.existing_tasks)
        existing_tasks_section = f"\nExisting Tasks (don't duplicate these):\n{tasks_str}\n"

    prompt = PLAN_GENERATION_PROMPT.format(
        description=request.description,
        context_section=context_section,
        existing_tasks_section=existing_tasks_section,
        max_tasks=request.max_tasks
    )

    response = await call_model(request.model, prompt)

    try:
        # Parse JSON response
        plan_data = json.loads(response)

        # Validate and convert to model
        tasks = []
        for task in plan_data.get("tasks", []):
            tasks.append(PlanTask(
                title=task.get("title", "Untitled Task"),
                description=task.get("description", ""),
                priority=task.get("priority", "medium"),
                dependencies=task.get("dependencies", []),
                estimated_effort=task.get("estimated_effort", "medium")
            ))

        return GeneratedPlan(
            project_name=plan_data.get("project_name", "New Project"),
            description=plan_data.get("description", request.description),
            tasks=tasks,
            suggested_milestones=plan_data.get("suggested_milestones", []),
            risks=plan_data.get("risks", []),
            success_criteria=plan_data.get("success_criteria", [])
        )

    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse model response as JSON: {str(e)}"
        )


@router.post("/refine-task")
async def refine_task(request: RefineTaskRequest):
    """Break down a task into subtasks with more detail."""
    context_section = ""
    if request.context:
        context_section = f"\nProject Context:\n{request.context}\n"

    prompt = TASK_REFINEMENT_PROMPT.format(
        task=request.task,
        context_section=context_section
    )

    response = await call_model(request.model, prompt)

    try:
        return json.loads(response)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse model response as JSON: {str(e)}"
        )


@router.post("/analyze")
async def analyze_project(request: AnalyzeProjectRequest):
    """Analyze a project and get recommendations."""
    tasks_json = json.dumps(request.tasks, indent=2)

    prompt = PROJECT_ANALYSIS_PROMPT.format(
        project_description=request.project_description,
        tasks_json=tasks_json
    )

    response = await call_model(request.model, prompt)

    try:
        return json.loads(response)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse model response as JSON: {str(e)}"
        )


@router.post("/suggest-next")
async def suggest_next_task(
    project_description: str,
    completed_tasks: List[str],
    pending_tasks: List[str],
    model: str = "llama3.2"
):
    """Suggest what task to work on next."""
    prompt = f"""You are a project manager assistant. Based on the project context, suggest which task to work on next.

Project: {project_description}

Completed Tasks:
{json.dumps(completed_tasks, indent=2)}

Pending Tasks:
{json.dumps(pending_tasks, indent=2)}

Analyze the pending tasks and suggest which one should be worked on next. Consider:
1. Dependencies (tasks that unblock others)
2. Priority
3. Logical sequence

Return JSON:
{{
    "suggested_task": "Task title",
    "reasoning": "Why this task should be next",
    "alternative": "Second choice task title",
    "blocked_tasks": ["Tasks that cannot start yet and why"]
}}

Return ONLY the JSON, no other text."""

    response = await call_model(model, prompt)

    try:
        return json.loads(response)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse model response as JSON: {str(e)}"
        )


@router.post("/estimate-effort")
async def estimate_effort(
    tasks: List[dict],
    model: str = "llama3.2"
):
    """Estimate effort for a list of tasks."""
    prompt = f"""You are a project estimation assistant. Estimate the effort required for each task.

Tasks:
{json.dumps(tasks, indent=2)}

For each task, provide an effort estimate. Return JSON:
{{
    "estimates": [
        {{
            "task": "Task title",
            "effort": "small|medium|large|extra-large",
            "complexity": "low|medium|high",
            "reasoning": "Brief explanation"
        }}
    ],
    "total_effort": "Overall project effort assessment",
    "suggestions": ["Any suggestions to reduce effort"]
}}

Return ONLY the JSON, no other text."""

    response = await call_model(model, prompt)

    try:
        return json.loads(response)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse model response as JSON: {str(e)}"
        )
