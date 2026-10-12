let input = ''
for await (const chunk of process.stdin) input += chunk

const checkoutPattern = /\bgit(?:\.exe)?\b[\s\S]{0,256}?\bcheckout\b/i

function deny() {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: 'git checkout is prohibited in this workspace.',
    },
  }))
}

let hookInput
try {
  hookInput = JSON.parse(input)
} catch {
  if (checkoutPattern.test(input)) deny()
  process.exit(0)
}

const toolName = String(hookInput.tool_name ?? '')
if (!/(terminal|powershell|shell|exec|run.?task|command)/i.test(toolName)) process.exit(0)

if (checkoutPattern.test(JSON.stringify(hookInput.tool_input ?? {}))) deny()
