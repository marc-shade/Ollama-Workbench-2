"""MCP (Model Context Protocol) management endpoints."""

import os
import json
from typing import Optional
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class MCPServer(BaseModel):
    """MCP server configuration."""
    name: str
    command: str
    args: list[str] = []
    env: dict[str, str] = {}
    enabled: bool = True


class MCPTool(BaseModel):
    """Tool exposed by an MCP server."""
    name: str
    description: str
    input_schema: dict


class MCPResource(BaseModel):
    """Resource exposed by an MCP server."""
    uri: str
    name: str
    mime_type: Optional[str] = None


# Default MCP config location
MCP_CONFIG_PATH = Path.home() / ".claude.json"


def load_mcp_config() -> dict:
    """Load MCP configuration from Claude config file."""
    if not MCP_CONFIG_PATH.exists():
        return {"mcpServers": {}}

    try:
        with open(MCP_CONFIG_PATH) as f:
            return json.load(f)
    except json.JSONDecodeError:
        return {"mcpServers": {}}


def save_mcp_config(config: dict):
    """Save MCP configuration."""
    with open(MCP_CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2)


@router.get("/servers")
async def list_servers():
    """List configured MCP servers."""
    config = load_mcp_config()
    servers = []

    for name, server_config in config.get("mcpServers", {}).items():
        servers.append(MCPServer(
            name=name,
            command=server_config.get("command", ""),
            args=server_config.get("args", []),
            env=server_config.get("env", {}),
            enabled=server_config.get("enabled", True)
        ))

    return {"servers": servers}


@router.post("/servers")
async def add_server(server: MCPServer):
    """Add a new MCP server configuration."""
    config = load_mcp_config()

    if "mcpServers" not in config:
        config["mcpServers"] = {}

    config["mcpServers"][server.name] = {
        "command": server.command,
        "args": server.args,
        "env": server.env,
        "enabled": server.enabled
    }

    save_mcp_config(config)
    return {"status": "added", "server": server}


@router.delete("/servers/{server_name}")
async def remove_server(server_name: str):
    """Remove an MCP server configuration."""
    config = load_mcp_config()

    if server_name not in config.get("mcpServers", {}):
        raise HTTPException(status_code=404, detail="Server not found")

    del config["mcpServers"][server_name]
    save_mcp_config(config)

    return {"status": "removed", "server": server_name}


@router.get("/servers/{server_name}/tools")
async def get_server_tools(server_name: str):
    """Get tools exposed by an MCP server."""
    # TODO: Actually connect to MCP server and list tools
    # For now, return mock data
    return {
        "server": server_name,
        "tools": [
            {
                "name": f"{server_name}_example_tool",
                "description": "Example tool from MCP server",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "input": {"type": "string"}
                    }
                }
            }
        ]
    }


@router.post("/servers/{server_name}/test")
async def test_server(server_name: str):
    """Test connection to an MCP server."""
    config = load_mcp_config()

    if server_name not in config.get("mcpServers", {}):
        raise HTTPException(status_code=404, detail="Server not found")

    server_config = config["mcpServers"][server_name]

    # TODO: Actually try to connect and run initialize
    return {
        "server": server_name,
        "status": "ok",
        "config": server_config
    }


@router.post("/discover")
async def discover_servers():
    """Discover available MCP servers from known registries."""
    # TODO: Implement actual discovery from npm, PyPI, etc.
    popular_servers = [
        {
            "name": "filesystem",
            "description": "File system access",
            "install": "npx -y @modelcontextprotocol/server-filesystem"
        },
        {
            "name": "memory",
            "description": "Persistent memory storage",
            "install": "python -m mcp_memory"
        },
        {
            "name": "brave-search",
            "description": "Web search via Brave",
            "install": "npx -y @modelcontextprotocol/server-brave-search"
        },
        {
            "name": "github",
            "description": "GitHub repository access",
            "install": "npx -y @modelcontextprotocol/server-github"
        }
    ]

    return {"available_servers": popular_servers}
