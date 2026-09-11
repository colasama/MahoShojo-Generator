// Web 兼容出口：故事输入投影由纯领域层统一维护。
export {
  STORY_PROMPT_CHARACTER_PARAMETERS_KEY,
  getStoryPromptCharacterParameters,
  sanitizeStoryPromptRecord,
  sanitizeStoryPromptValue,
  type StoryPromptSanitizeOptions,
} from '@mahoshojo/domain/story-prompt-data';
