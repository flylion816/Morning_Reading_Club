export type CourseModule = { id: string; name: string; type: 'shortText' | 'text' | 'body' | 'image' };
export type CourseTemplateExtensions = { duration: boolean; closingVideo: boolean; podcast: boolean };
export type CourseTemplateDraft = { name: string; modules: CourseModule[]; extensions?: CourseTemplateExtensions; revision?: number };
export type CourseTemplate = CourseTemplateDraft & { _id?: string; id?: string; active: boolean; builtIn?: boolean; revision: number };
export type CourseTemplateSnapshot = CourseTemplateDraft & { templateId: string; revision: number };
