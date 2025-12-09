"""Prompt template management endpoints."""

import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class PromptTemplate(BaseModel):
    """Prompt template with variables."""
    id: Optional[str] = None
    name: str
    description: Optional[str] = None
    content: str
    variables: list[str] = []  # Extracted from {{variable}} syntax
    tags: list[str] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    version: int = 1


class PromptRenderRequest(BaseModel):
    """Request to render a prompt with variables."""
    template_id: str
    variables: dict[str, str]


class PromptTestRequest(BaseModel):
    """Request to test a prompt against a model."""
    template_id: str
    variables: dict[str, str]
    model: str


# In-memory store (replace with SQLite in production)
prompts_store: dict[str, PromptTemplate] = {}

# Initialize with some example templates
EXAMPLE_TEMPLATES = [
    PromptTemplate(
        id="code-review",
        name="Code Review",
        description="Review code for bugs, style, and improvements",
        content="""Review the following {{language}} code for:
1. Bugs and potential issues
2. Code style and best practices
3. Performance improvements
4. Security concerns

Code:
```{{language}}
{{code}}
```

Provide specific, actionable feedback.""",
        variables=["language", "code"],
        tags=["code", "review"],
        created_at=datetime.now(),
        updated_at=datetime.now()
    ),
    PromptTemplate(
        id="explain-code",
        name="Explain Code",
        description="Explain what code does in plain language",
        content="""Explain the following {{language}} code in plain language.
Focus on:
- What the code does overall
- Key functions and their purpose
- Any notable patterns or techniques used

Code:
```{{language}}
{{code}}
```""",
        variables=["language", "code"],
        tags=["code", "explanation"],
        created_at=datetime.now(),
        updated_at=datetime.now()
    ),
    PromptTemplate(
        id="write-tests",
        name="Write Tests",
        description="Generate unit tests for code",
        content="""Write comprehensive unit tests for the following {{language}} code using {{test_framework}}.

Include:
- Happy path tests
- Edge cases
- Error handling tests

Code to test:
```{{language}}
{{code}}
```

Generate complete, runnable test code.""",
        variables=["language", "test_framework", "code"],
        tags=["code", "testing"],
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
]

for template in EXAMPLE_TEMPLATES:
    prompts_store[template.id] = template


def extract_variables(content: str) -> list[str]:
    """Extract {{variable}} patterns from content."""
    import re
    pattern = r'\{\{(\w+)\}\}'
    return list(set(re.findall(pattern, content)))


@router.get("")
async def list_prompts(tag: Optional[str] = None):
    """List all prompt templates."""
    prompts = list(prompts_store.values())

    if tag:
        prompts = [p for p in prompts if tag in p.tags]

    return {"prompts": prompts}


@router.post("")
async def create_prompt(template: PromptTemplate):
    """Create a new prompt template."""
    template.id = str(uuid.uuid4())[:8]
    template.variables = extract_variables(template.content)
    template.created_at = datetime.now()
    template.updated_at = datetime.now()
    template.version = 1

    prompts_store[template.id] = template
    return {"prompt": template}


@router.get("/{prompt_id}")
async def get_prompt(prompt_id: str):
    """Get a prompt template by ID."""
    if prompt_id not in prompts_store:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return {"prompt": prompts_store[prompt_id]}


@router.put("/{prompt_id}")
async def update_prompt(prompt_id: str, template: PromptTemplate):
    """Update a prompt template."""
    if prompt_id not in prompts_store:
        raise HTTPException(status_code=404, detail="Prompt not found")

    existing = prompts_store[prompt_id]
    template.id = prompt_id
    template.variables = extract_variables(template.content)
    template.created_at = existing.created_at
    template.updated_at = datetime.now()
    template.version = existing.version + 1

    prompts_store[prompt_id] = template
    return {"prompt": template}


@router.delete("/{prompt_id}")
async def delete_prompt(prompt_id: str):
    """Delete a prompt template."""
    if prompt_id not in prompts_store:
        raise HTTPException(status_code=404, detail="Prompt not found")

    del prompts_store[prompt_id]
    return {"status": "deleted", "prompt_id": prompt_id}


@router.post("/render")
async def render_prompt(request: PromptRenderRequest):
    """Render a prompt template with variables."""
    if request.template_id not in prompts_store:
        raise HTTPException(status_code=404, detail="Prompt not found")

    template = prompts_store[request.template_id]
    content = template.content

    # Replace variables
    for var, value in request.variables.items():
        content = content.replace(f"{{{{{var}}}}}", value)

    # Check for missing variables
    missing = extract_variables(content)
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing variables: {missing}"
        )

    return {"rendered": content, "template": template.name}


@router.post("/test")
async def test_prompt(request: PromptTestRequest):
    """Test a rendered prompt against a model."""
    import os
    import httpx

    OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")

    # Render the prompt
    render_result = await render_prompt(PromptRenderRequest(
        template_id=request.template_id,
        variables=request.variables
    ))

    rendered_prompt = render_result["rendered"]

    # Send to model
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            response = await client.post(
                f"{OLLAMA_HOST}/api/chat",
                json={
                    "model": request.model,
                    "messages": [{"role": "user", "content": rendered_prompt}],
                    "stream": False
                }
            )
            response.raise_for_status()
            data = response.json()

            return {
                "template": request.template_id,
                "model": request.model,
                "rendered_prompt": rendered_prompt,
                "response": data.get("message", {}).get("content", ""),
                "raw": data
            }

        except httpx.HTTPError as e:
            raise HTTPException(status_code=503, detail=f"Model error: {str(e)}")


@router.get("/tags")
async def list_tags():
    """List all unique tags."""
    tags = set()
    for prompt in prompts_store.values():
        tags.update(prompt.tags)
    return {"tags": sorted(list(tags))}
