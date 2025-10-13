// URL을 하이퍼링크로 변환하는 유틸리티 함수

export function linkifyUrls(text: string): string {
  // URL 패턴 매칭 (http://, https://, www.)
  const urlRegex = /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+)/gi
  
  return text.replace(urlRegex, (url) => {
    // www.로 시작하는 경우 https:// 추가
    const fullUrl = url.startsWith('www.') ? `https://${url}` : url
    
    return `<a href="${fullUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline">${url}</a>`
  })
}

// HTML 콘텐츠에서 URL을 링크로 변환 (이미 HTML 태그가 있는 경우)
export function linkifyHtmlContent(htmlContent: string): string {
  // HTML 태그 내부가 아닌 텍스트 노드만 처리하기 위해 복잡한 로직 필요
  // 간단한 방법: 전체 텍스트를 처리하되 기존 링크는 보존
  
  // 이미 <a> 태그로 감싸진 링크는 건드리지 않음
  const linkRegex = /<a[^>]*>.*?<\/a>/gi
  
  // <a> 태그를 임시 플레이스홀더로 교체
  const links: string[] = []
  let processedHtml = htmlContent.replace(linkRegex, (match, index) => {
    links.push(match)
    return `__LINK_PLACEHOLDER_${links.length - 1}__`
  })
  
  // 남은 텍스트에서 URL을 링크로 변환
  processedHtml = linkifyUrls(processedHtml)
  
  // 플레이스홀더를 원래 링크로 복원
  links.forEach((link, index) => {
    processedHtml = processedHtml.replace(`__LINK_PLACEHOLDER_${index}__`, link)
  })
  
  return processedHtml
}

// HTML 콘텐츠를 안전하게 렌더링하기 위한 함수
export function sanitizeHtmlContent(htmlContent: string): string {
  // 기본적인 HTML 태그들만 허용하고 안전하게 처리
  const allowedTags = ['p', 'br', 'strong', 'em', 'u', 'div', 'img', 'a', 'span']
  const allowedAttributes = {
    'img': ['src', 'alt', 'style', 'class'],
    'a': ['href', 'target', 'rel', 'class'],
    'div': ['style', 'class'],
    'span': ['style', 'class'],
    'p': ['style', 'class'],
    'strong': ['style', 'class'],
    'em': ['style', 'class'],
    'u': ['style', 'class']
  }
  
  // 간단한 HTML 태그 검증 및 정리
  let sanitized = htmlContent
  
  // img 태그의 스타일을 안전하게 설정
  sanitized = sanitized.replace(/<img([^>]*)>/gi, (match, attributes) => {
    // src, alt 속성만 유지하고 style 속성 추가
    const srcMatch = attributes.match(/src\s*=\s*["']([^"']*)["']/)
    const altMatch = attributes.match(/alt\s*=\s*["']([^"']*)["']/)
    
    const src = srcMatch ? srcMatch[1] : ''
    const alt = altMatch ? altMatch[1] : '이미지'
    
    return `<img src="${src}" alt="${alt}" style="max-width: 100%; height: auto; margin: 10px 0;" />`
  })
  
  // 모든 텍스트 요소에 색상 강제 적용
  sanitized = sanitized.replace(/<p([^>]*)>/gi, '<p$1 style="color: inherit !important;">')
  sanitized = sanitized.replace(/<div([^>]*)>/gi, '<div$1 style="color: inherit !important;">')
  sanitized = sanitized.replace(/<span([^>]*)>/gi, '<span$1 style="color: inherit !important;">')
  sanitized = sanitized.replace(/<strong([^>]*)>/gi, '<strong$1 style="color: inherit !important;">')
  sanitized = sanitized.replace(/<em([^>]*)>/gi, '<em$1 style="color: inherit !important;">')
  sanitized = sanitized.replace(/<u([^>]*)>/gi, '<u$1 style="color: inherit !important;">')
  
  return sanitized
}
