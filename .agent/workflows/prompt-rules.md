---
description: Rules and constraints for AI prompts in the application
---

# Prompt Rules

## Character Limit

**All prompts MUST be less than 1000 characters.**

When implementing or modifying any prompt-related functionality:

1. **Validation**: Always validate prompt length before submission
2. **UI Feedback**: Display character count and remaining characters to users
3. **Error Handling**: Show clear error messages when prompts exceed 1000 characters
4. **Truncation**: If auto-truncation is needed, truncate at word boundaries

## Implementation Guidelines

When working with prompts in components:

```typescript
const MAX_PROMPT_LENGTH = 1000;

// Validate prompt length
const isValidPrompt = (prompt: string): boolean => {
  return prompt.length < MAX_PROMPT_LENGTH;
};

// Get remaining characters
const getRemainingChars = (prompt: string): number => {
  return MAX_PROMPT_LENGTH - prompt.length;
};
```

## Components Affected

- `PromptBuilder.tsx`
- `BatchGenerator.tsx`
- `CreativeMixer.tsx`
- `ImageToPrompt.tsx`
- Any other component handling user prompts
