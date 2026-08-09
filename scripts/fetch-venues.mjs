// ビルド時に一度だけ実行し、ホットペッパーグルメAPI（リクルート）から
// 東京・大阪市・名古屋市の喫煙可能なバー・居酒屋の実店舗データを取得して
// src/data/venues.json に書き出す。APIキーはCI/ローカルの環境変数のみで
// 使用し、クライアントに配布される静的ファイルには含めない。
import { writeFileSync, mkdirSync } from 'node:fs'

const API_KEY = process.env.HOTPEPPER_API_KEY
if (!API_KEY) {
  console.error('HOTPEPPER_API_KEY is not set. Skipping venue fetch (writing empty list).')
  mkdirSync(new URL('../src/data', import.meta.url), { recursive: true })
  writeFileSync(new URL('../src/data/venues.json', import.meta.url), '[]\n')
  process.exit(0)
}

// 東京 + 全20政令指定都市で全国展開する。
const CITIES = [
  '東京', '札幌市', '仙台市', 'さいたま市', '千葉市', '横浜市', '川崎市',
  '相模原市', '新潟市', '静岡市', '浜松市', '名古屋市', '京都市', '大阪市',
  '堺市', '神戸市', '岡山市', '広島市', '北九州市', '福岡市', '熊本市',
].map((name) => ({ area: name, keyword: name }))
const GENRES = ['G001', 'G002', 'G012'] // 居酒屋 / ダイニングバー・バル / バー・カクテル
const PER_CITY_LIMIT = 20

// 「全面禁煙」は喫煙可能店として案内すべきでないため除外する。
// 空欄・不明は誤情報になるため同じく除外する。
function isSmokingFriendly(nonSmokingText) {
  if (!nonSmokingText) return false
  if (nonSmokingText.includes('全面禁煙')) return false
  return true
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchGenre(keyword, genre, start) {
  const url = new URL('https://webservice.recruit.co.jp/hotpepper/gourmet/v1/')
  url.searchParams.set('key', API_KEY)
  url.searchParams.set('format', 'json')
  url.searchParams.set('address', keyword)
  url.searchParams.set('genre', genre)
  url.searchParams.set('count', '100')
  url.searchParams.set('start', String(start))
  const res = await fetch(url)
  await sleep(120) // APIへの負荷を抑えるための小休止
  if (!res.ok) {
    console.error(`HotPepper API error ${res.status} for ${keyword}/${genre}/start=${start}`)
    return []
  }
  const data = await res.json()
  return data?.results?.shop ?? []
}

async function main() {
  const allVenues = []

  for (const city of CITIES) {
    const seen = new Set()
    const cityVenues = []

    for (const genre of GENRES) {
      // 各ジャンルにつき最大2ページ（100件×2）まで取得し、店舗の偏りを抑える。
      for (const start of [1, 101]) {
        const shops = await fetchGenre(city.keyword, genre, start)
        for (const shop of shops) {
          if (seen.has(shop.id)) continue
          if (!isSmokingFriendly(shop.non_smoking)) continue
          seen.add(shop.id)
          cityVenues.push({
            id: shop.id,
            name: shop.name,
            area: city.area,
            neighborhood: shop.middle_area?.name ?? '',
            station: shop.station_name ?? '',
            category: shop.genre?.name ?? '',
            smokingPolicy: shop.non_smoking,
            budget: shop.budget?.average ?? shop.budget?.name ?? '',
            catch: shop.catch ?? '',
            open: shop.open ?? '',
            sourceUrl: shop.urls?.pc ?? '',
            photoUrl: shop.photo?.pc?.m ?? '',
          })
        }
        if (shops.length < 100) break // これ以上ページがない
      }
    }

    allVenues.push(...cityVenues.slice(0, PER_CITY_LIMIT))
    console.log(`${city.area}: ${cityVenues.length} smoking-friendly venues found (kept ${Math.min(cityVenues.length, PER_CITY_LIMIT)})`)
  }

  mkdirSync(new URL('../src/data', import.meta.url), { recursive: true })
  writeFileSync(
    new URL('../src/data/venues.json', import.meta.url),
    JSON.stringify(allVenues, null, 2) + '\n'
  )
  console.log(`Wrote ${allVenues.length} venues to src/data/venues.json`)
}

main()
