import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Configure marked to ensure GFM is enabled (it is by default in newer versions but explicit is good)
// and to match the styling expectations
marked.use({
  gfm: true,
  breaks: true,
});

// Tags and attributes we intentionally emit in the post-processing step below.
// Everything else is stripped by DOMPurify before we touch the output.
const PURIFY_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'ul', 'ol', 'li',
    'a',
    'blockquote',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'strong', 'em', 'code', 'pre',
    'div', 'span',
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'scope'],
  // Forbid javascript: URIs in hrefs
  ALLOW_DATA_ATTR: false,
};

export const convertMarkdownToHtml = (text: string): string => {
  if (!text) return '';

  // 1. Parse markdown → raw HTML
  const rawHtml = marked.parse(text) as string;

  // 2. Sanitize FIRST — strips any attacker-injected tags/scripts before we
  //    inject Tailwind classes. This is the XSS firewall for all call sites.
  const sanitized = DOMPurify.sanitize(rawHtml, PURIFY_CONFIG);

  // 3. Post-process to add Tailwind classes matching the original design
  return sanitized
    .replace(/<h1>/g, '<h1 class="text-2xl font-bold text-gray-900 mt-8 mb-4">')
    .replace(/<h2>/g, '<h2 class="text-xl font-bold text-gray-900 mt-8 mb-4">')
    .replace(/<h3>/g, '<h3 class="text-lg font-semibold text-gray-900 mt-6 mb-3">')
    .replace(/<p>/g, '<p class="mb-3 text-gray-700 leading-relaxed">')
    .replace(/<ul>/g, '<ul class="mb-4 list-disc list-outside ml-4">')
    .replace(/<ol>/g, '<ol class="mb-4 list-decimal list-outside ml-4">')
    .replace(/<li>/g, '<li class="mb-1 text-gray-700">')
    .replace(/<a /g, '<a class="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer" ')
    .replace(/<blockquote>/g, '<blockquote class="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-4">')
    .replace(/<table>/g, '<div class="overflow-x-auto mb-4"><table class="min-w-full divide-y divide-gray-200 border border-gray-200">')
    .replace(/<\/table>/g, '</table></div>')
    .replace(/<thead>/g, '<thead class="bg-gray-50">')
    .replace(/<th>/g, '<th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">')
    .replace(/<td>/g, '<td class="px-3 py-2 whitespace-nowrap text-sm text-gray-700 border-b border-gray-100">');
};

export const stripMarkdown = (text: string): string => {
  return text
    .replace(/#{1,6}\s/g, '') // Remove headers
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.*?)\*/g, '$1') // Remove italic
    .replace(/^[-*+]\s/gm, '• ') // Convert bullets
    .replace(/^\d+\.\s/gm, '') // Remove numbered list markers
    .replace(/\|/g, ' ') // Remove table pipes
    .trim();
};