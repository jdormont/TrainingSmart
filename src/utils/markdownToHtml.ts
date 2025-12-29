// Utility to convert markdown-like text to HTML for better readability

export const convertMarkdownToHtml = (text: string): string => {
  let html = text;
  
  // Convert headers
  html = html.replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold text-gray-900 mt-6 mb-3">$1</h3>');
  html = html.replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold text-gray-900 mt-8 mb-4">$1</h2>');
  html = html.replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold text-gray-900 mt-8 mb-4">$1</h1>');
  
  // Convert bold text
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>');
  
  // Convert markdown links to clickable HTML links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">$1</a>');
  
  // Convert bullet points
  html = html.replace(/^- (.*$)/gm, '<li class="ml-4 mb-1">• $1</li>');
  html = html.replace(/^ {2}- (.*$)/gm, '<li class="ml-8 mb-1">◦ $1</li>');
  
  // Convert numbered lists
  html = html.replace(/^\d+\. (.*$)/gm, '<li class="ml-4 mb-2 list-decimal">$1</li>');
  
  // Wrap consecutive list items in ul tags
  html = html.replace(/(<li class="ml-4[^>]*>.*?<\/li>\s*)+/gs, '<ul class="mb-4">$&</ul>');
  html = html.replace(/(<li class="ml-8[^>]*>.*?<\/li>\s*)+/gs, '<ul class="mb-2">$&</ul>');
  
  // Convert line breaks to paragraphs
  const paragraphs = html.split('\n\n').filter(p => p.trim());
  html = paragraphs.map(p => {
    const trimmed = p.trim();
    // Don't wrap if it's already an HTML element
    if (trimmed.startsWith('<')) {
      return trimmed;
    }
    // Don't wrap empty lines
    if (!trimmed) {
      return '';
    }
    return `<p class="mb-3 text-gray-700 leading-relaxed">${trimmed}</p>`;
  }).join('\n');
  
  // Clean up any double-wrapped elements
  html = html.replace(/<p[^>]*>(<h[1-6][^>]*>.*?<\/h[1-6]>)<\/p>/g, '$1');
  html = html.replace(/<p[^>]*>(<ul[^>]*>.*?<\/ul>)<\/p>/gs, '$1');
  
  return html;
};

export const stripMarkdown = (text: string): string => {
  return text
    .replace(/#{1,6}\s/g, '') // Remove headers
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.*?)\*/g, '$1') // Remove italic
    .replace(/^[-*+]\s/gm, '• ') // Convert bullets
    .replace(/^\d+\.\s/gm, '') // Remove numbered list markers
    .trim();
};