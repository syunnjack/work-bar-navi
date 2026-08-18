import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ホットペッパーグルメAPIから、喫煙できる店舗を都市ごとに取得して
// src/data/venues.json を作り直す。
//
// 使い方:
//   HP_API_KEY=<キー> node scripts/fetch-venues.mjs [1都市あたりの上限]
//
// キーはリクルートのWEBサービスで発行したもの。コードには書かず環境変数で渡す。
// APIには1日あたりの上限があるため、必要なときだけ実行する。
//
// 検索はキーワードではなく「中エリアコード」で行う。キーワード検索だと
// 店名に地名が入っているだけの他都市の店が混ざる（例: 京都市の検索結果に
// 東京の店が入る）ため。中エリアコードは middle_area API から取得する。

const key = process.env.HP_API_KEY
if (!key) {
  console.error('HP_API_KEY が設定されていません。環境変数で渡してください。')
  process.exit(1)
}

const perCity = Number(process.argv[2] || 60)
const outFile = resolve(process.cwd(), 'src', 'data', 'venues.json')

// 都市ごとの中エリア名。ホットペッパーの区分に合わせている。
const cityAreas = {
  '東京': ['渋谷', '新宿', '池袋', '上野・御徒町・浅草', '銀座・有楽町・新橋・築地・月島', '東京・大手町・日本橋・人形町', '赤坂・六本木・麻布十番・西麻布', '恵比寿・中目黒・代官山・広尾', '品川･目黒･田町･浜松町･五反田', '神田・神保町・秋葉原・御茶ノ水', '錦糸町・浅草橋・両国・亀戸', '水道橋・飯田橋・神楽坂'],
  '札幌市': ['すすきの', '札幌（札幌駅・大通）', '麻生・北24条（北区・東区）', '南郷・新札幌　白石・厚別・清田', '琴似・円山公園　中央・西・手稲', '平岸・澄川（豊平区・南区）'],
  '仙台市': ['仙台市', '青葉・宮城野・若林', '泉中央', '長町'],
  'さいたま市': ['大宮・さいたま新都心', '浦和・武蔵浦和'],
  '千葉市': ['千葉・稲毛', '海浜幕張'],
  '横浜市': ['横浜', '桜木町みなとみらい･関内･中華街', '新横浜・綱島・菊名・鴨居', '上大岡・杉田・新杉田・金沢文庫'],
  '川崎市': ['川崎・鶴見', '溝の口・たまプラーザ・青葉台', '武蔵小杉・元住吉・新丸子'],
  '相模原市': ['相模原・橋本・淵野辺', '本厚木･相模大野･海老名･伊勢原'],
  '新潟市': ['新潟駅・万代・古町周辺', '新潟東区・北区エリア', '新潟西エリア', '出来島･女池･桜木･鳥屋野潟周辺', '亀田・新津エリア'],
  '静岡市': ['静岡駅周辺・葵区・駿河区', '清水駅周辺～草薙'],
  '浜松市': ['浜松'],
  '名古屋市': ['名古屋（名古屋駅/西区/中村区）', '栄ｷﾀ錦/伏見丸の内/泉/東桜/新栄', '栄(ミナミ)/矢場町/大須/上前津', '金山・神宮前・熱田区', '大曽根･千種･今池･池下･守山区'],
  '京都市': ['河原町・木屋町', '祇園・先斗町', '烏丸御池・四条烏丸', '烏丸五条・京都駅周辺', '四条大宮・西院・右京区・西京区', '左京区・山科区', '北区・上京区', '伏見桃山・伏見区・京都市郊外'],
  '大阪市': ['梅田', '心斎橋・なんば・南船場・堀江', '天王寺', '淀屋橋・本町・北浜・天満橋', '京橋・天満・天六・南森町'],
  '堺市': ['堺・高石市・和泉市'],
  '神戸市': ['神戸', '灘・東灘', '須磨・垂水・西区・兵庫・長田', '北区・有馬温泉・三田'],
  '岡山市': ['岡山市'],
  '広島市': ['広島市（広島市中心部）', '広島駅・横川・その他広島市内'],
  '北九州市': ['北九州（小倉・門司）', '北九州（八幡・黒崎・折尾）'],
  '福岡市': ['天神・西中洲・春吉', '博多', '中洲・中洲川端', '大名・今泉・警固', '薬院･平尾･高砂'],
  '熊本市': ['熊本市(上通り･下通り･新市街)', '熊本市郊外'],
}

// 店内で吸えるか、席によって吸える店だけを載せる。「全面禁煙」は対象外。
const smokingAllowed = new Set(['禁煙席なし', '一部禁煙'])

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

async function getJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const json = await response.json()
  if (json.results?.error) throw new Error(JSON.stringify(json.results.error))
  return json.results
}

// 中エリア名 → コードの対応表を作る
const middleAreas = []
for (let start = 1; start <= 601; start += 100) {
  const results = await getJson(`https://webservice.recruit.co.jp/hotpepper/middle_area/v1/?key=${key}&format=json&count=100&start=${start}`)
  const list = results.middle_area ?? []
  middleAreas.push(...list)
  if (list.length < 100) break
  await sleep(200)
}
const codeByName = new Map(middleAreas.map((area) => [area.name, area.code]))

function toVenue(shop, cityName) {
  return {
    id: shop.id,
    name: shop.name,
    area: cityName,
    neighborhood: shop.middle_area?.name ?? '',
    station: shop.station_name ?? '',
    category: shop.genre?.name ?? '',
    smokingPolicy: shop.non_smoking ?? '',
    // budget_memo は「－」だけのことがあるので、その場合は budget.name を使う
    budget: shop.budget_memo && shop.budget_memo !== '－' ? shop.budget_memo : (shop.budget?.name ?? ''),
    catch: shop.catch ?? '',
    open: shop.open ?? '',
    sourceUrl: shop.urls?.pc ?? '',
    photoUrl: shop.photo?.pc?.l ?? shop.photo?.pc?.m ?? '',
  }
}

const collected = []
const seen = new Set()
const missingAreas = []

for (const [city, areaNames] of Object.entries(cityAreas)) {
  const codes = areaNames.map((name) => {
    const code = codeByName.get(name)
    if (!code) missingAreas.push(`${city} / ${name}`)
    return code
  }).filter(Boolean)

  // 中エリアごとの候補をためる。1つのエリアだけで上限に達すると、
  // その都市が1エリアだけの内容になり、エリア別ページが作れなくなるため、
  // まず全エリアから集めてから均等に振り分ける。
  const byArea = new Map()
  for (const code of codes) {
    const found = []
    let start = 1
    let available = Infinity
    // 1エリアあたり最大300件まで見る（それ以上は喫煙可の店が十分見つかっている）
    while (found.length < perCity && start <= available && start <= 201) {
      const results = await getJson(`https://webservice.recruit.co.jp/hotpepper/gourmet/v1/?key=${key}&format=json&count=100&start=${start}&middle_area=${code}`)
      available = Number(results.results_available ?? 0)
      const shops = results.shop ?? []
      if (shops.length === 0) break

      for (const shop of shops) {
        if (!smokingAllowed.has(shop.non_smoking)) continue
        if (seen.has(shop.id)) continue
        seen.add(shop.id)
        found.push(toVenue(shop, city))
      }

      start += 100
      await sleep(300) // 相手のサーバーに負担をかけないよう間隔を空ける
    }
    byArea.set(code, found)
  }

  // まず各エリアから均等に取り、余りがあれば残っているエリアから足す
  const quota = Math.max(3, Math.ceil(perCity / Math.max(codes.length, 1)))
  const picked = []
  for (const code of codes) {
    picked.push(...(byArea.get(code) ?? []).slice(0, quota))
  }
  for (const code of codes) {
    if (picked.length >= perCity) break
    const rest = (byArea.get(code) ?? []).slice(quota)
    picked.push(...rest.slice(0, perCity - picked.length))
  }
  // 取り過ぎた分は戻す（上限を超えないようにする）
  const trimmed = picked.slice(0, perCity)
  for (const item of picked.slice(perCity)) seen.delete(item.id)
  picked.length = 0
  picked.push(...trimmed)

  collected.push(...picked)
  console.log(`${city}: ${picked.length}店（中エリア ${codes.length}件）`)
}

if (missingAreas.length > 0) {
  console.warn(`\n中エリア名が見つかりませんでした（取得から漏れています）:\n  ${missingAreas.join('\n  ')}`)
}

writeFileSync(outFile, `${JSON.stringify(collected, null, 2)}\n`)
console.log(`\n合計 ${collected.length}店を書き出しました。`)
