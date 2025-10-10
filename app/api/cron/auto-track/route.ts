import { NextRequest, NextResponse } from 'next/server'
import { getStores } from '@/lib/store-firestore'
import { getKeywords } from '@/lib/keyword-firestore'
import { getRankings, addRankings } from '@/lib/ranking-firestore'
import { fetchNaverRanking } from '@/lib/ranking-utils'

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 자동 추적 시작:', new Date().toISOString())
    
    // 모든 지점 조회
    const stores = await getStores()
    console.log(`📊 총 ${stores.length}개 지점 발견`)
    
    const results = []
    
    for (const store of stores) {
      console.log(`🏪 지점 처리 중: ${store.name}`)
      
      try {
        // 해당 지점의 키워드 조회
        const keywords = await getKeywords(store.id)
        console.log(`🔍 키워드 ${keywords.length}개 발견`)
        
        if (keywords.length === 0) {
          console.log(`⚠️ ${store.name}: 키워드 없음, 건너뜀`)
          continue
        }
        
        // 오늘 날짜 (YYYY-MM-DD)
        const today = new Date().toISOString().split('T')[0]
        
        // 각 키워드에 대해 순위 조회
        const newRankings = []
        
        for (const keyword of keywords) {
          if (!keyword.isActive) {
            console.log(`⏭️ ${keyword.keyword}: 비활성화, 건너뜀`)
            continue
          }
          
          try {
            console.log(`🔍 ${keyword.keyword} 순위 조회 중...`)
            
            const rankingResult = await fetchNaverRanking(
              keyword.keyword, 
              store.name, 
              store.address
            )
            
            if (rankingResult.mobileRank !== null || rankingResult.pcRank !== null) {
              newRankings.push({
                storeId: store.id,
                keywordId: keyword.id,
                date: today,
                mobileRank: rankingResult.mobileRank,
                pcRank: rankingResult.pcRank,
                isAutoTracked: true
              })
              
              console.log(`✅ ${keyword.keyword}: 모바일 ${rankingResult.mobileRank}위, PC ${rankingResult.pcRank}위`)
            } else {
              console.log(`❌ ${keyword.keyword}: 순위 없음 (50위 이하)`)
            }
            
            // API 호출 간격 (네이버 API 제한 고려)
            await new Promise(resolve => setTimeout(resolve, 1000))
            
          } catch (error) {
            console.error(`❌ ${keyword.keyword} 순위 조회 실패:`, error)
          }
        }
        
        // 새로운 순위 데이터 저장
        if (newRankings.length > 0) {
          await addRankings(newRankings)
          console.log(`💾 ${store.name}: ${newRankings.length}개 순위 저장 완료`)
        }
        
        results.push({
          store: store.name,
          keywords: keywords.length,
          rankings: newRankings.length,
          success: true
        })
        
      } catch (error) {
        console.error(`❌ ${store.name} 처리 실패:`, error)
        results.push({
          store: store.name,
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false
        })
      }
    }
    
    const successCount = results.filter(r => r.success).length
    const totalRankings = results.reduce((sum, r) => sum + (r.rankings || 0), 0)
    
    console.log(`✅ 자동 추적 완료: ${successCount}/${stores.length} 지점, ${totalRankings}개 순위 저장`)
    
    return NextResponse.json({
      success: true,
      message: `자동 추적 완료: ${successCount}/${stores.length} 지점, ${totalRankings}개 순위 저장`,
      results,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ 자동 추적 오류:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
