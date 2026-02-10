---
name: context-loader
description: Load project context for Gemini CLI. Ensures Gemini understands the requirements_creator project and can provide relevant research.
---

# Context Loader for requirements_creator (Gemini)

## Purpose

Load project context so Gemini CLI can provide targeted research for app requirements generation.

## When to Activate

**ALWAYS** — Run at the beginning of research tasks.

## Workflow

### Step 1: Understand Project

This project generates app requirement documents from trend keywords:
- News/trend data is collected and keywords are extracted
- Keywords are used to brainstorm innovative app concepts
- Detailed requirements are generated for each app

### Step 2: Understand Research Goal

Your research should help inform:
- What market trends relate to the extracted keywords
- What existing solutions exist and their gaps
- What technology stacks are trending
- What user pain points remain unaddressed

### Step 3: Execute Research

Use Google Search grounding to find:
- Current market data and trends
- Competitor analysis
- Technology landscape
- User feedback and pain points

## Output Guidelines

- Structure with clear headings
- Include source URLs when available
- Focus on actionable insights for app design
- Note constraints and risks
