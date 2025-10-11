import { NextRequest, NextResponse } from 'next/server'

const NAVER_COMMERCE_CLIENT_ID = process.env.NAVER_COMMERCE_CLIENT_ID || ''
const NAVER_COMMERCE_CLIENT_SECRET = process.env.NAVER_COMMERCE_CLIENT_SECRET || ''

// 네이버 커머스 API 인증 상세 디버깅
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const password = searchParams.get('password')

    // 관리자 인증
    if (password !== '43084308') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔍 상세 디버깅 시작...')

    // 1. 환경변수 확인
    const envCheck = {
      clientId: NAVER_COMMERCE_CLIENT_ID,
      clientSecret: NAVER_COMMERCE_CLIENT_SECRET,
      clientIdLength: NAVER_COMMERCE_CLIENT_ID.length,
      clientSecretLength: NAVER_COMMERCE_CLIENT_SECRET.length,
      clientSecretPrefix: NAVER_COMMERCE_CLIENT_SECRET.substring(0, 10),
      clientSecretSuffix: NAVER_COMMERCE_CLIENT_SECRET.substring(NAVER_COMMERCE_CLIENT_SECRET.length - 10)
    }

    console.log('🔑 환경변수 확인:', envCheck)

    // 2. 공식 문서 예시와 비교
    const exampleClientId = "aaaabbbbcccc"
    const exampleClientSecret = "$2a$10$abcdefghijklmnopqrstuv"
    const exampleTimestamp = 1643961623299

    console.log('📋 공식 문서 예시:')
    console.log('  - Client ID:', exampleClientId)
    console.log('  - Client Secret:', exampleClientSecret)
    console.log('  - Timestamp:', exampleTimestamp)

    // 3. 실제 값으로 테스트
    const bcrypt = require("bcrypt")
    const timestamp = Date.now()
    const signaturePassword = `${NAVER_COMMERCE_CLIENT_ID}_${timestamp}`

    console.log('📝 실제 생성 값:')
    console.log('  - Client ID:', NAVER_COMMERCE_CLIENT_ID)
    console.log('  - Client Secret:', NAVER_COMMERCE_CLIENT_SECRET)
    console.log('  - Timestamp:', timestamp)
    console.log('  - Password:', signaturePassword)

    // 4. bcrypt 해싱 테스트 (bcryptjs 사용)
    let hashed = null
    let client_secret_sign = null
    
    try {
      const bcryptjs = require("bcryptjs")
      hashed = bcryptjs.hashSync(signaturePassword, NAVER_COMMERCE_CLIENT_SECRET)
      client_secret_sign = Buffer.from(hashed, "utf-8").toString("base64")
      
      console.log('🔐 해싱 결과:')
      console.log('  - Hashed:', hashed.substring(0, 50) + '...')
      console.log('  - Signature:', client_secret_sign.substring(0, 50) + '...')
    } catch (hashError) {
      console.error('❌ 해싱 오류:', hashError)
    }

    // 5. 공식 문서 예시로 테스트
    const examplePassword = `${exampleClientId}_${exampleTimestamp}`
    let exampleHashed = null
    let exampleSignature = null
    
    try {
      const bcryptjs = require("bcryptjs")
      exampleHashed = bcryptjs.hashSync(examplePassword, exampleClientSecret)
      exampleSignature = Buffer.from(exampleHashed, "utf-8").toString("base64")
      
      console.log('📚 공식 예시 해싱:')
      console.log('  - Example Password:', examplePassword)
      console.log('  - Example Hashed:', exampleHashed.substring(0, 50) + '...')
      console.log('  - Example Signature:', exampleSignature.substring(0, 50) + '...')
    } catch (exampleError) {
      console.error('❌ 공식 예시 해싱 오류:', exampleError)
    }

    // 6. 실제 API 호출 테스트
    let tokenResponse = null
    let tokenError = null
    
    if (client_secret_sign) {
      try {
        const authTokenUrl = 'https://api.commerce.naver.com/external/v1/oauth2/token'
        
        const response = await fetch(authTokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            'client_id': NAVER_COMMERCE_CLIENT_ID,
            'timestamp': timestamp.toString(),
            'client_secret_sign': client_secret_sign,
            'grant_type': 'client_credentials',
            'type': 'SELF'
          }),
        })

        tokenResponse = {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok
        }

        if (!response.ok) {
          tokenError = await response.text()
        } else {
          const tokenData = await response.json()
          tokenResponse.data = tokenData
        }

        console.log('📡 API 호출 결과:', tokenResponse)
        if (tokenError) {
          console.error('❌ API 오류:', tokenError)
        }

      } catch (apiError) {
        console.error('❌ API 호출 오류:', apiError)
        tokenError = apiError.message
      }
    }

    return NextResponse.json({
      success: true,
      message: '상세 디버깅 완료',
      environment: envCheck,
      officialExample: {
        clientId: exampleClientId,
        clientSecret: exampleClientSecret,
        timestamp: exampleTimestamp,
        password: examplePassword,
        hashed: exampleHashed?.substring(0, 50) + '...',
        signature: exampleSignature?.substring(0, 50) + '...'
      },
      actualValues: {
        clientId: NAVER_COMMERCE_CLIENT_ID,
        clientSecret: NAVER_COMMERCE_CLIENT_SECRET,
        timestamp: timestamp,
        password: signaturePassword,
        hashed: hashed?.substring(0, 50) + '...',
        signature: client_secret_sign?.substring(0, 50) + '...'
      },
      apiResponse: tokenResponse,
      apiError: tokenError
    })

  } catch (error) {
    console.error('❌ 디버깅 실패:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '디버깅 실패',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
