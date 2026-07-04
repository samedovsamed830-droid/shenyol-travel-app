import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type UploadApiResponse = {
  data?: {
    url?: string
    image?: {
      url?: string
    }
  }
  error?: {
    message?: string
  }
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.IMGBB_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'IMGBB_API_KEY is not configured on server. Add it to .env.local and restart dev server.' },
        { status: 400 },
      )
    }

    const formData = await request.formData()
    const image = formData.get('image')

    if (!(image instanceof File)) {
      return NextResponse.json({ error: 'Image file is required.' }, { status: 400 })
    }

    const outbound = new FormData()
    outbound.append('image', image)

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: outbound,
    })

    const result = (await response.json()) as UploadApiResponse

    const originalUrl = result.data?.image?.url || result.data?.url

    if (!response.ok || !originalUrl) {
      return NextResponse.json(
        { error: result.error?.message ?? 'Image upload failed.' },
        { status: response.status || 500 },
      )
    }

    return NextResponse.json({ url: originalUrl }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Unexpected upload error.' }, { status: 500 })
  }
}
