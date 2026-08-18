import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// 都市別の静的ページを作る。
// トップページは JavaScript で描画するため、検索エンジンには本文が届かない。
// 「札幌 喫煙可 居酒屋」のような検索に応えられるよう、都市ごとに
// 中身の入った HTML を書き出しておく。データは src/data/venues.json をそのまま使う。

const root = resolve(process.cwd())
const venues = JSON.parse(readFileSync(resolve(root, 'src', 'data', 'venues.json'), 'utf8'))
const publicDir = resolve(root, 'public')
const areasDir = resolve(publicDir, 'area')
const sitemapFile = resolve(publicDir, 'sitemap.xml')

const origin = 'https://workbar.jp'

// URL に日本語を使うと共有時に長くなるため、都市ごとにローマ字の slug を用意する
const citySlugs = {
  '東京': 'tokyo',
  '札幌市': 'sapporo',
  '仙台市': 'sendai',
  'さいたま市': 'saitama',
  '千葉市': 'chiba',
  '横浜市': 'yokohama',
  '川崎市': 'kawasaki',
  '相模原市': 'sagamihara',
  '新潟市': 'niigata',
  '静岡市': 'shizuoka',
  '浜松市': 'hamamatsu',
  '名古屋市': 'nagoya',
  '京都市': 'kyoto',
  '大阪市': 'osaka',
  '堺市': 'sakai',
  '神戸市': 'kobe',
  '岡山市': 'okayama',
  '広島市': 'hiroshima',
  '北九州市': 'kitakyushu',
  '福岡市': 'fukuoka',
  '熊本市': 'kumamoto',
}

// アフィリエイトの設定は src/App.jsx と同じものを使う
const VC_SID = '3771711'
const VC_PID_HOTPEPPER = '892675881'
const valueCommerceUrl = (pid, targetUrl) =>
  `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${VC_SID}&pid=${pid}&vc_url=${encodeURIComponent(targetUrl)}`

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')

const cities = [...new Set(venues.map((item) => item.area))].filter((area) => citySlugs[area])
const unknown = [...new Set(venues.map((item) => item.area))].filter((area) => !citySlugs[area])
if (unknown.length > 0) {
  // slug が無い都市は URL を作れないので、黙って落とさず気づけるようにする
  console.warn(`slug が未登録の都市があります: ${unknown.join(', ')}`)
}

const styles = `
      :root { color-scheme: light dark; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: "Hiragino Sans", "Yu Gothic", Meiryo, system-ui, sans-serif; background: #12100e; color: #f4efe7; }
      main { width: min(1080px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 56px; }
      a { color: #f0c98a; }
      .hero, .venue, .section-box { border: 1px solid rgba(244, 239, 231, .16); border-radius: 12px; background: rgba(255, 255, 255, .04); }
      .hero { padding: 26px; margin-bottom: 18px; }
      .eyebrow { margin: 0; font-size: 12px; letter-spacing: .12em; color: #f0c98a; font-weight: 800; }
      h1 { margin: 8px 0 14px; font-size: clamp(26px, 4vw, 40px); line-height: 1.2; }
      h2 { font-size: 19px; margin: 0 0 12px; }
      h3 { font-size: 16px; margin: 0 0 6px; }
      p, li { line-height: 1.8; }
      .lead { margin: 0; color: rgba(244, 239, 231, .82); }
      .ad-disclosure { margin: 0 0 18px; padding: 10px 14px; border: 1px solid rgba(244, 239, 231, .2); border-radius: 8px; font-size: 13px; color: rgba(244, 239, 231, .78); }
      .ad-label { display: inline-block; padding: 1px 8px; border-radius: 4px; border: 1px solid currentColor; font-size: 11px; font-weight: 700; opacity: .8; vertical-align: middle; }
      .venue-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
      .venue { padding: 16px; display: grid; gap: 8px; align-content: start; }
      .venue img { width: 100%; height: 160px; object-fit: cover; border-radius: 8px; background: rgba(255, 255, 255, .06); }
      .tag-row { display: flex; flex-wrap: wrap; gap: 6px; }
      .tag-row span { font-size: 12px; padding: 3px 10px; border-radius: 999px; background: rgba(244, 239, 231, .1); }
      .venue .open { font-size: 12px; color: rgba(244, 239, 231, .7); }
      .venue .links { font-size: 13px; margin: 0; }
      .section-box { padding: 18px; margin-top: 20px; }
      .city-links { display: flex; flex-wrap: wrap; gap: 8px; list-style: none; margin: 0; padding: 0; }
      .city-links a { display: inline-block; padding: 7px 14px; border: 1px solid rgba(244, 239, 231, .22); border-radius: 999px; text-decoration: none; font-size: 13px; }
      .back { display: inline-block; margin-top: 14px; font-weight: 700; }
      @media (max-width: 600px) { .venue-grid { grid-template-columns: 1fr; } }
`

const adDisclosure = '<p class="ad-disclosure">このページには広告（アフィリエイトリンク）が含まれます。リンク先での申し込みにより、当サイトが紹介料を受け取ることがあります。</p>'

function renderVenue(item) {
  return `        <article class="venue">
          <img src="${escapeHtml(item.photoUrl)}" alt="${escapeHtml(item.name)}の外観または料理の写真" loading="lazy" width="320" height="160" />
          <h3>${escapeHtml(item.name)}</h3>
          ${item.catch ? `<p>${escapeHtml(item.catch)}</p>` : ''}
          <div class="tag-row">
            <span>${escapeHtml(item.category)}</span>
            ${item.station ? `<span>${escapeHtml(item.station)}駅</span>` : ''}
            ${item.smokingPolicy ? `<span>${escapeHtml(item.smokingPolicy)}</span>` : ''}
            ${item.budget ? `<span>${escapeHtml(item.budget)}</span>` : ''}
          </div>
          ${item.open ? `<p class="open">${escapeHtml(item.open)}</p>` : ''}
          <p class="links"><span class="ad-label">広告</span> <a href="${escapeHtml(valueCommerceUrl(VC_PID_HOTPEPPER, item.sourceUrl))}" target="_blank" rel="nofollow noopener noreferrer sponsored">詳細を見る（ホットペッパーグルメ）</a></p>
        </article>`
}

function cityPage(city) {
  const slug = citySlugs[city]
  const items = venues.filter((item) => item.area === city)
  const url = `${origin}/area/${slug}/`
  const neighborhoods = [...new Set(items.map((item) => item.neighborhood).filter(Boolean))]
  const stations = [...new Set(items.map((item) => item.station).filter(Boolean))]
  const noSmokingFree = items.filter((item) => item.smokingPolicy === '禁煙席なし').length
  const title = `${city}の喫煙可能な居酒屋・バー${items.length}店｜喫煙OKバーナビ`
  const description = `${city}で喫煙できる居酒屋・バーを${items.length}店掲載。${neighborhoods.slice(0, 4).join('・')}などのエリア別に、喫煙ポリシー、営業時間、予算を確認できます。`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    url,
    description,
    about: { '@type': 'Thing', name: `${city}の喫煙可能な飲食店` },
  }
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '喫煙OKバーナビ', item: `${origin}/` },
      { '@type': 'ListItem', position: 2, name: '都市から探す', item: `${origin}/area/` },
      { '@type': 'ListItem', position: 3, name: city, item: url },
    ],
  }

  const otherCities = cities.filter((item) => item !== city)

  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="喫煙OKバーナビ" />
    <meta property="og:locale" content="ja_JP" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    <script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>
    <style>${styles}</style>
  </head>
  <body>
    <main>
      <section class="hero">
        <p class="eyebrow">${escapeHtml(city)}</p>
        <h1>${escapeHtml(city)}の喫煙できる居酒屋・バー</h1>
        <p class="lead">${escapeHtml(city)}で喫煙できるお店を${items.length}店まとめています。掲載しているのはホットペッパーグルメの実店舗データで、喫煙ポリシーは公式の情報をそのまま表示しています。${noSmokingFree > 0 ? `このうち${noSmokingFree}店は「禁煙席なし」、つまり店内で喫煙できるお店です。` : ''}</p>
        <p class="lead">主なエリアは${escapeHtml(neighborhoods.slice(0, 5).join('、'))}。${escapeHtml(stations.slice(0, 5).join('、'))}などの駅の周辺にあります。</p>
        <a class="back" href="/">駅名や店名で検索する</a>
      </section>

      ${adDisclosure}

      <section class="venue-grid">
${items.map(renderVenue).join('\n')}
      </section>

      <section class="section-box">
        <h2>喫煙できるお店を探すときに見ておく点</h2>
        <p>喫煙のルールは変わることがあります。2020年の改正健康増進法で多くの飲食店が原則屋内禁煙になり、条件を満たした店だけが喫煙可能な扱いを続けています。来店前に、各店舗のリンク先で最新の表示を確認してください。</p>
        <p>「禁煙席なし」は店内で喫煙できるお店、「一部禁煙」は喫煙できる席とできない席が分かれているお店です。加熱式たばこのみ可としている店もあるため、紙巻きたばこを吸う場合は店舗ごとの記載をご確認ください。</p>
      </section>

${neighborhoodPages.filter((page) => page.city === city).length > 0 ? `      <section class="section-box">
        <h2>${escapeHtml(city)}のエリアから探す</h2>
        <ul class="city-links">
${neighborhoodPages.filter((page) => page.city === city).map((page) => `          <li><a href="/area/${slug}/${encodeURIComponent(page.slug)}/">${escapeHtml(shortName(page.hood))}（${page.items.length}店）</a></li>`).join('\n')}
        </ul>
      </section>` : ''}

${stationPages.filter((page) => page.city === city).length > 0 ? `      <section class="section-box">
        <h2>${escapeHtml(city)}の駅から探す</h2>
        <ul class="city-links">
${stationPages.filter((page) => page.city === city).map((page) => `          <li><a href="/area/${slug}/station/${encodeURIComponent(page.station)}/">${escapeHtml(page.station)}駅（${page.items.length}店）</a></li>`).join('\n')}
        </ul>
      </section>` : ''}

      <section class="section-box">
        <h2>ほかの都市で探す</h2>
        <ul class="city-links">
${otherCities.map((item) => `          <li><a href="/area/${citySlugs[item]}/">${escapeHtml(item)}</a></li>`).join('\n')}
        </ul>
      </section>
    </main>
  </body>
</html>
`
}

// 繁華街（ホットペッパーのエリア区分）ごとのページ。
// 「すすきの 喫煙可」のように、都市より細かい言葉で探す人に応える。
// ただし次の場合は作らない。都市ページと中身がほぼ同じになり、
// 似たページを増やすだけになるため。
//   - 掲載店舗が3店未満
//   - エリア名が都市名と実質同じ（例: 仙台市 / 仙台市）
//   - その都市にエリアが1つしかない
//   - その都市の店舗の8割以上を占める（名前が違っても中身が都市ページと同じになる）
const normalize = (value) => String(value).replace(/[市区（）()・･　 ]/g, '')

// URL に使う短い名前。「錦糸町・浅草橋・両国・亀戸」なら「錦糸町」を使う。
// エリア名には「栄ｷﾀ錦/伏見丸の内/泉」のようにスラッシュを含むものがあり、
// そのまま使うと URL が多階層に割れてしまうため、区切り文字として扱う。
const shortName = (neighborhood) => neighborhood.split(/[・･（(　 /／]/)[0]

// 名前が重なったときの逃げ道。パスに使えない文字を置き換える
const safeSlug = (value) => value.replace(/[/／\\?#%]/g, '-')

const neighborhoodPages = []
for (const city of cities) {
  const cityItems = venues.filter((item) => item.area === city)
  const hoods = [...new Set(cityItems.map((item) => item.neighborhood).filter(Boolean))]
  const used = new Set()
  for (const hood of hoods) {
    const hoodItems = cityItems.filter((item) => item.neighborhood === hood)
    const sameAsCity = normalize(hood) === normalize(city)
    const coversCity = hoodItems.length / cityItems.length >= 0.8
    if (hoodItems.length < 3 || sameAsCity || coversCity || hoods.length === 1) continue
    let slug = safeSlug(shortName(hood))
    if (used.has(slug)) slug = safeSlug(hood)
    used.add(slug)
    neighborhoodPages.push({ city, hood, slug, items: hoodItems })
  }
}

function neighborhoodPage(page) {
  const { city, hood, slug, items } = page
  const citySlug = citySlugs[city]
  const url = `${origin}/area/${citySlug}/${encodeURIComponent(slug)}/`
  const stations = [...new Set(items.map((item) => item.station).filter(Boolean))]
  const smokeFree = items.filter((item) => item.smokingPolicy === '禁煙席なし').length
  const shortLabel = shortName(hood)
  const title = `${shortLabel}（${city}）の喫煙可能な居酒屋・バー${items.length}店｜喫煙OKバーナビ`
  const description = `${city}の${hood}で喫煙できる居酒屋・バーを${items.length}店掲載。${stations.slice(0, 4).join('・')}の周辺で、喫煙ポリシー、営業時間、予算を確認できます。`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    url,
    description,
    about: { '@type': 'Thing', name: `${shortLabel}の喫煙可能な飲食店` },
  }
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '喫煙OKバーナビ', item: `${origin}/` },
      { '@type': 'ListItem', position: 2, name: '都市から探す', item: `${origin}/area/` },
      { '@type': 'ListItem', position: 3, name: city, item: `${origin}/area/${citySlug}/` },
      { '@type': 'ListItem', position: 4, name: shortLabel, item: url },
    ],
  }

  const sameCityPages = neighborhoodPages.filter((item) => item.city === city && item.slug !== slug)

  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="喫煙OKバーナビ" />
    <meta property="og:locale" content="ja_JP" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    <script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>
    <style>${styles}</style>
  </head>
  <body>
    <main>
      <section class="hero">
        <p class="eyebrow">${escapeHtml(city)} / ${escapeHtml(hood)}</p>
        <h1>${escapeHtml(shortLabel)}の喫煙できる居酒屋・バー</h1>
        <p class="lead">${escapeHtml(city)}の${escapeHtml(hood)}エリアで喫煙できるお店を${items.length}店まとめています。${smokeFree > 0 ? `このうち${smokeFree}店は「禁煙席なし」で、店内で喫煙できます。` : ''}最寄りは${escapeHtml(stations.slice(0, 5).join('、'))}です。</p>
        <a class="back" href="/area/${citySlug}/">${escapeHtml(city)}のお店をまとめて見る</a>
      </section>

      ${adDisclosure}

      <section class="venue-grid">
${items.map(renderVenue).join('\n')}
      </section>

      <section class="section-box">
        <h2>来店前に確認したいこと</h2>
        <p>喫煙のルールは変わることがあります。掲載しているのは各店舗が公開している情報で、「禁煙席なし」は店内で喫煙できるお店、「一部禁煙」は席によって分かれているお店です。加熱式たばこのみ可としている店もあるため、リンク先で最新の表示をご確認ください。</p>
      </section>

${sameCityPages.length > 0 ? `      <section class="section-box">
        <h2>${escapeHtml(city)}のほかのエリア</h2>
        <ul class="city-links">
${sameCityPages.map((item) => `          <li><a href="/area/${citySlugs[item.city]}/${encodeURIComponent(item.slug)}/">${escapeHtml(shortName(item.hood))}</a></li>`).join('\n')}
        </ul>
      </section>` : ''}
    </main>
  </body>
</html>
`
}

// 駅ごとのページ。「三宮 喫煙可 居酒屋」のように駅名で探す人に応える。
// エリアページと同じく、似たページを増やさないための条件をつける。
//   - 掲載店舗が5店未満
//   - その都市の店舗の8割以上を占める（都市ページと同じ内容になる）
//   - 同じ都市のエリアページと掲載店舗が8割以上重なる
const stationPages = []
for (const city of cities) {
  const cityItems = venues.filter((item) => item.area === city)
  const stations = [...new Set(cityItems.map((item) => item.station).filter(Boolean))]
  for (const station of stations) {
    const stationItems = cityItems.filter((item) => item.station === station)
    if (stationItems.length < 5) continue
    if (stationItems.length / cityItems.length >= 0.8) continue
    const ids = new Set(stationItems.map((item) => item.id))
    const overlaps = neighborhoodPages.some((page) => {
      if (page.city !== city) return false
      const shared = page.items.filter((item) => ids.has(item.id)).length
      return shared / ids.size >= 0.8
    })
    if (overlaps) continue
    stationPages.push({ city, station, items: stationItems })
  }
}

function stationPage(page) {
  const { city, station, items } = page
  const citySlug = citySlugs[city]
  const url = `${origin}/area/${citySlug}/station/${encodeURIComponent(station)}/`
  const hoods = [...new Set(items.map((item) => item.neighborhood).filter(Boolean))]
  const smokeFree = items.filter((item) => item.smokingPolicy === '禁煙席なし').length
  const title = `${station}駅周辺の喫煙可能な居酒屋・バー${items.length}店｜喫煙OKバーナビ`
  const description = `${city}の${station}駅周辺で喫煙できる居酒屋・バーを${items.length}店掲載。営業時間、予算、喫煙ポリシーを確認できます。`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    url,
    description,
    about: { '@type': 'Thing', name: `${station}駅周辺の喫煙可能な飲食店` },
  }
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '喫煙OKバーナビ', item: `${origin}/` },
      { '@type': 'ListItem', position: 2, name: '都市から探す', item: `${origin}/area/` },
      { '@type': 'ListItem', position: 3, name: city, item: `${origin}/area/${citySlug}/` },
      { '@type': 'ListItem', position: 4, name: `${station}駅`, item: url },
    ],
  }

  const otherStations = stationPages.filter((item) => item.city === city && item.station !== station)

  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="喫煙OKバーナビ" />
    <meta property="og:locale" content="ja_JP" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    <script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>
    <style>${styles}</style>
  </head>
  <body>
    <main>
      <section class="hero">
        <p class="eyebrow">${escapeHtml(city)}</p>
        <h1>${escapeHtml(station)}駅周辺の喫煙できる居酒屋・バー</h1>
        <p class="lead">${escapeHtml(station)}駅の周辺で喫煙できるお店を${items.length}店まとめています。${smokeFree > 0 ? `このうち${smokeFree}店は「禁煙席なし」で、店内で喫煙できます。` : ''}${hoods.length > 0 ? `${escapeHtml(hoods.join('、'))}のエリアにあります。` : ''}</p>
        <a class="back" href="/area/${citySlug}/">${escapeHtml(city)}のお店をまとめて見る</a>
      </section>

      ${adDisclosure}

      <section class="venue-grid">
${items.map(renderVenue).join('\n')}
      </section>

      <section class="section-box">
        <h2>来店前に確認したいこと</h2>
        <p>喫煙のルールは変わることがあります。掲載しているのは各店舗が公開している情報で、「禁煙席なし」は店内で喫煙できるお店、「一部禁煙」は席によって分かれているお店です。加熱式たばこのみ可としている店もあるため、リンク先で最新の表示をご確認ください。</p>
      </section>

${otherStations.length > 0 ? `      <section class="section-box">
        <h2>${escapeHtml(city)}のほかの駅</h2>
        <ul class="city-links">
${otherStations.map((item) => `          <li><a href="/area/${citySlug}/station/${encodeURIComponent(item.station)}/">${escapeHtml(item.station)}駅</a></li>`).join('\n')}
        </ul>
      </section>` : ''}
    </main>
  </body>
</html>
`
}

function indexPage() {
  const url = `${origin}/area/`
  const title = '都市から喫煙できる居酒屋・バーを探す｜喫煙OKバーナビ'
  const description = `全国${cities.length}都市の喫煙可能な居酒屋・バー${venues.length}店を、都市別にまとめています。`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    url,
    description,
  }

  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="喫煙OKバーナビ" />
    <meta property="og:locale" content="ja_JP" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    <style>${styles}</style>
  </head>
  <body>
    <main>
      <section class="hero">
        <p class="eyebrow">AREA INDEX</p>
        <h1>都市から探す</h1>
        <p class="lead">全国${cities.length}都市の喫煙できる居酒屋・バーを${venues.length}店まとめています。行き先の都市を選ぶと、店舗の一覧、喫煙ポリシー、営業時間、予算を確認できます。</p>
        <a class="back" href="/">駅名や店名で検索する</a>
      </section>

      <section class="section-box">
        <h2>掲載している都市</h2>
        <ul class="city-links">
${cities.map((city) => `          <li><a href="/area/${citySlugs[city]}/">${escapeHtml(city)}（${venues.filter((item) => item.area === city).length}店）</a></li>`).join('\n')}
        </ul>
      </section>
    </main>
  </body>
</html>
`
}

rmSync(areasDir, { recursive: true, force: true })
mkdirSync(areasDir, { recursive: true })
writeFileSync(resolve(areasDir, 'index.html'), indexPage())

for (const city of cities) {
  const dir = resolve(areasDir, citySlugs[city])
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, 'index.html'), cityPage(city))
}

for (const page of neighborhoodPages) {
  const dir = resolve(areasDir, citySlugs[page.city], page.slug)
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, 'index.html'), neighborhoodPage(page))
}

// 駅ページはエリア名と混ざらないよう station/ の下に置く
for (const page of stationPages) {
  const dir = resolve(areasDir, citySlugs[page.city], 'station', page.station)
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, 'index.html'), stationPage(page))
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${origin}/</loc><priority>1.0</priority></url>
  <url><loc>${origin}/area/</loc><priority>0.9</priority></url>
${cities.map((city) => `  <url><loc>${origin}/area/${citySlugs[city]}/</loc><priority>0.8</priority></url>`).join('\n')}
${neighborhoodPages.map((page) => `  <url><loc>${origin}/area/${citySlugs[page.city]}/${encodeURIComponent(page.slug)}/</loc><priority>0.7</priority></url>`).join('\n')}
${stationPages.map((page) => `  <url><loc>${origin}/area/${citySlugs[page.city]}/station/${encodeURIComponent(page.station)}/</loc><priority>0.7</priority></url>`).join('\n')}
</urlset>
`
writeFileSync(sitemapFile, sitemap)

console.log(`Generated ${cities.length} city pages, ${neighborhoodPages.length} neighborhood pages and ${stationPages.length} station pages (${venues.length} venues), and updated sitemap.`)
