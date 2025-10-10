// GitHub API를 통한 파일 업데이트
export async function updateSystemsFile(systems: any[]) {
  try {
    // GitHub Personal Access Token이 필요합니다
    const token = process.env.NEXT_PUBLIC_GITHUB_TOKEN
    
    if (!token) {
      throw new Error('GitHub token not found')
    }

    // systems.ts 파일 내용 생성
    const fileContent = `export interface System {
  id: string
  title: string
  description: string
  icon: string
  color: string
  category: string
  url?: string
  status: 'active' | 'inactive' | 'maintenance'
  tags?: string[]
  optimization?: string[]
}

export const systems: System[] = ${JSON.stringify(systems, null, 2)}`

    // GitHub API를 통한 파일 업데이트
    const response = await fetch('https://api.github.com/repos/senti270/portal/contents/data/systems.ts', {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Update systems data via admin panel',
        content: btoa(unescape(encodeURIComponent(fileContent))), // Base64 인코딩
        sha: await getFileSHA()
      })
    })

    if (!response.ok) {
      throw new Error('Failed to update GitHub file')
    }

    return await response.json()
  } catch (error) {
    console.error('GitHub API error:', error)
    throw error
  }
}

// 파일의 현재 SHA 가져오기
async function getFileSHA(): Promise<string> {
  const token = process.env.NEXT_PUBLIC_GITHUB_TOKEN
  
  const response = await fetch('https://api.github.com/repos/senti270/portal/contents/data/systems.ts', {
    headers: {
      'Authorization': `token ${token}`,
    }
  })

  if (!response.ok) {
    throw new Error('Failed to get file SHA')
  }

  const data = await response.json()
  return data.sha
}
