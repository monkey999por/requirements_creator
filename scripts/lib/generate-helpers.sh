#!/usr/bin/env bash
# =============================================================================
# generate-helpers.sh — generate.sh / regenerate.sh 共通関数
# =============================================================================
#
# 呼び出し元で以下の変数が設定済みであること:
#   CONFIG_FILE        — app.config.yaml のパス
#   REQUIREMENTS_DIR   — gen/requirements のパス
#   SKIP_AGENTS        — true/false
#   TMPDIR_AGENTS      — 一時ファイルディレクトリ
#   RESEARCH_CONTEXT   — リサーチ結果ファイルパス
#   DESIGN_CONTEXT     — 設計提案ファイルパス
#   REVIEW_RESULT      — レビュー結果ファイルパス
# =============================================================================

# =============================================================================
# エージェント設定読み込み
# =============================================================================

get_agent_enabled() {
  local agent="$1"
  local val
  val=$(awk "/^  *${agent}:/{found=1} found && /enabled:/{print \$2; exit}" <(sed -n '/^generate:/,/^[^ ]/p' "$CONFIG_FILE") 2>/dev/null || true)
  [[ "$val" == "true" ]]
}

get_agent_model() {
  local agent="$1"
  awk "/^  *${agent}:/{found=1} found && /model:/{print \$2; exit}" <(sed -n '/^generate:/,/^[^ ]/p' "$CONFIG_FILE") 2>/dev/null || true
}

get_agent_sandbox() {
  local agent="$1"
  awk "/^  *${agent}:/{found=1} found && /sandbox:/{print \$2; exit}" <(sed -n '/^generate:/,/^[^ ]/p' "$CONFIG_FILE") 2>/dev/null || true
}

has_agent_role() {
  local agent="$1"
  local role="$2"
  local in_agent=false
  local in_roles=false
  while IFS= read -r line; do
    if [[ "$line" =~ ^[[:space:]]*${agent}: ]]; then
      in_agent=true
      in_roles=false
      continue
    fi
    if $in_agent && [[ "$line" =~ ^[[:space:]]*roles: ]]; then
      in_roles=true
      continue
    fi
    if $in_agent && $in_roles; then
      if [[ "$line" =~ ^[[:space:]]*-[[:space:]]*(.+) ]]; then
        local r="${BASH_REMATCH[1]}"
        r=$(echo "$r" | tr -d ' ')
        if [[ "$r" == "$role" ]]; then
          return 0
        fi
      else
        in_roles=false
        in_agent=false
      fi
    fi
    if $in_agent && [[ "$line" =~ ^[[:space:]]{4}[a-z] && ! "$line" =~ ^[[:space:]]*- ]]; then
      in_agent=false
      in_roles=false
    fi
  done < <(sed -n '/^generate:/,/^[^ ]/p' "$CONFIG_FILE" 2>/dev/null)
  return 1
}

# 指定ロールを実行可能なエージェントが存在するか
can_run_role() {
  local role="$1"
  if $SKIP_AGENTS; then return 1; fi
  for agent in codex gemini; do
    if get_agent_enabled "$agent" && has_agent_role "$agent" "$role"; then
      return 0
    fi
  done
  return 1
}

# 指定ロールを持つ最初のエージェント名を返す
get_role_agent() {
  local role="$1"
  for agent in codex gemini; do
    if get_agent_enabled "$agent" && has_agent_role "$agent" "$role"; then
      echo "$agent"
      return 0
    fi
  done
  return 1
}

# =============================================================================
# エージェント実行関数
# =============================================================================

run_research_phase() {
  local keyword_file="$1"
  local agent
  agent=$(get_role_agent "researcher") || return 0

  echo "--- Phase 1: Research ($agent) ---"
  local model
  model=$(get_agent_model "$agent")

  local keywords
  keywords=$(cat "$keyword_file")

  if [[ "$agent" == "gemini" ]]; then
    gemini -p "
You are a trend research analyst. Analyze these extracted keywords for current technology trends and market opportunities.

Keywords data:
${keywords}

Research and provide:
1. Current market trends related to these keywords (2025-2026)
2. Existing apps/services in these spaces and their gaps
3. Emerging technology trends that could be leveraged
4. User pain points that current solutions don't address
5. Potential market opportunities

Output: Structured analysis in markdown format.
" 2>/dev/null > "$RESEARCH_CONTEXT" || true

  elif [[ "$agent" == "codex" ]]; then
    local sandbox
    sandbox=$(get_agent_sandbox "$agent")
    sandbox="${sandbox:-read-only}"
    codex exec --model "${model:-o4-mini}" --sandbox "$sandbox" --full-auto "
You are a trend research analyst. Analyze these extracted keywords for current technology trends and market opportunities.

Keywords data:
${keywords}

Research and provide:
1. Current market trends related to these keywords
2. Existing apps/services in these spaces and their gaps
3. Technology trends that could be leveraged
4. User pain points that current solutions don't address
5. Potential market opportunities

Output: Structured analysis in markdown format.
" 2>/dev/null > "$RESEARCH_CONTEXT" || true
  fi

  if [[ -s "$RESEARCH_CONTEXT" ]]; then
    echo "  リサーチ結果: $(wc -l < "$RESEARCH_CONTEXT") 行"
  else
    echo "  リサーチ結果: なし（スキップ）"
    rm -f "$RESEARCH_CONTEXT"
  fi
}

run_design_phase() {
  local keyword_file="$1"
  local agent
  agent=$(get_role_agent "designer") || return 0

  echo "--- Phase 2: Design ($agent) ---"
  local model
  model=$(get_agent_model "$agent")

  local keywords
  keywords=$(cat "$keyword_file")

  local research_input=""
  if [[ -f "$RESEARCH_CONTEXT" ]]; then
    research_input="

Additional research context:
$(cat "$RESEARCH_CONTEXT")"
  fi

  if [[ "$agent" == "codex" ]]; then
    local sandbox
    sandbox=$(get_agent_sandbox "$agent")
    sandbox="${sandbox:-read-only}"
    codex exec --model "${model:-o4-mini}" --sandbox "$sandbox" --full-auto "
You are an innovative app designer. Given these keywords from trend analysis, brainstorm a creative and viable app concept.

Keywords data:
${keywords}
${research_input}

IMPORTANT: Don't suggest obvious apps. Use association thinking - jump 1-2 conceptual levels from the keywords to find innovative ideas.

Provide:
1. App name (English, kebab-case)
2. Core concept (1-2 sentences)
3. Target users and their pain points
4. 5-8 core features with descriptions and priorities (High/Medium/Low)
5. Suggested technology stack with rationale
6. Monetization strategy

Output: Structured markdown format.
" 2>/dev/null > "$DESIGN_CONTEXT" || true

  elif [[ "$agent" == "gemini" ]]; then
    gemini -p "
You are an innovative app designer. Given these keywords from trend analysis, brainstorm a creative and viable app concept.

Keywords data:
${keywords}
${research_input}

IMPORTANT: Don't suggest obvious apps. Use association thinking - jump 1-2 conceptual levels from the keywords to find innovative ideas.

Provide:
1. App name (English, kebab-case)
2. Core concept (1-2 sentences)
3. Target users and their pain points
4. 5-8 core features with descriptions and priorities
5. Suggested technology stack with rationale
6. Monetization strategy

Output: Structured markdown format.
" 2>/dev/null > "$DESIGN_CONTEXT" || true
  fi

  if [[ -s "$DESIGN_CONTEXT" ]]; then
    echo "  設計提案: $(wc -l < "$DESIGN_CONTEXT") 行"
  else
    echo "  設計提案: なし（スキップ）"
    rm -f "$DESIGN_CONTEXT"
  fi
}

run_review_phase() {
  local app_name="$1"
  local agent
  agent=$(get_role_agent "reviewer") || return 0

  local app_dir="${REQUIREMENTS_DIR}/${app_name}"
  if [[ ! -d "$app_dir" ]]; then
    echo "  レビュー対象ディレクトリが見つかりません: ${app_dir}"
    return 0
  fi

  echo "--- Phase 4: Review ($agent) ---"
  local model
  model=$(get_agent_model "$agent")

  # overview.mdとfeatureファイルを読み取り
  local overview=""
  if [[ -f "${app_dir}/overview.md" ]]; then
    overview=$(cat "${app_dir}/overview.md")
  fi

  local features=""
  for f in "${app_dir}"/features/*.md; do
    if [[ -f "$f" ]]; then
      features="${features}

--- $(basename "$f") ---
$(cat "$f")"
    fi
  done

  if [[ "$agent" == "codex" ]]; then
    local sandbox
    sandbox=$(get_agent_sandbox "$agent")
    sandbox="${sandbox:-read-only}"
    codex exec --model "${model:-o4-mini}" --sandbox "$sandbox" --full-auto "
Review these app requirements for quality and completeness.

## overview.md
${overview}

## Feature Specs
${features}

Evaluate:
1. Is the concept clear and the scope realistic?
2. Do the features comprehensively cover user needs?
3. Is the technical stack feasible and well-chosen?
4. Are there consistency issues between overview and features?
5. Are non-functional requirements adequately addressed?

Output format:
## Review Summary
### Score: A/B/C
### Strengths
### Issues (table: #, Severity, File, Issue, Suggestion)
### Recommendations
" 2>/dev/null > "$REVIEW_RESULT" || true

  elif [[ "$agent" == "gemini" ]]; then
    gemini -p "
Review these app requirements for quality and completeness.

## overview.md
${overview}

## Feature Specs
${features}

Evaluate:
1. Is the concept clear and the scope realistic?
2. Do the features comprehensively cover user needs?
3. Is the technical stack feasible and well-chosen?
4. Are there consistency issues between overview and features?
5. Are non-functional requirements adequately addressed?

Output format:
## Review Summary
### Score: A/B/C
### Strengths
### Issues (table: #, Severity, File, Issue, Suggestion)
### Recommendations
" 2>/dev/null > "$REVIEW_RESULT" || true
  fi

  if [[ -s "$REVIEW_RESULT" ]]; then
    echo "  レビュー結果: $(wc -l < "$REVIEW_RESULT") 行"
    echo ""
    echo "--- レビューサマリー ---"
    head -30 "$REVIEW_RESULT"
    echo "..."
  else
    echo "  レビュー結果: なし（スキップ）"
    rm -f "$REVIEW_RESULT"
  fi
}

# =============================================================================
# プロンプトファイル作成
# =============================================================================
# SKILL.md のフロントマターを除去し、templates.md を結合したプロンプトファイルを作成
# 引数: 出力先ファイルパス
# 呼び出し元で PROJECT_ROOT が設定済みであること
create_prompt_file() {
  local output_path="$1"
  local skill_file="${PROJECT_ROOT}/.claude/skills/generate-requirements/SKILL.md"
  local templates_file="${PROJECT_ROOT}/.claude/skills/generate-requirements/templates.md"

  awk 'BEGIN{n=0} /^---/{n++; next} n>=2{print}' "$skill_file" > "$output_path"
  echo "" >> "$output_path"
  echo "---" >> "$output_path"
  echo "" >> "$output_path"
  cat "$templates_file" >> "$output_path"
}
