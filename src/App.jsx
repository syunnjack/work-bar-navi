import { useMemo, useState } from 'react'
import './App.css'
import venues from './data/venues.json'

const postKey = 'work-bar-navi.posts'
const savedKey = 'work-bar-navi.saved'

// 楽天トラベルのアフィリエイトID（golf-search.orgと同一アカウント）。
// 終電を逃した利用者が今すぐホテルを検索できるよう、駅名/エリア名を
// キーワードにした楽天トラベル検索ページへのアフィリエイトリンクを組み立てる。
const RAKUTEN_AFFILIATE_ID = '13078974.c074128c.13078975.03b0a557'
function rakutenHotelSearchUrl(keyword) {
  const target = `https://travel.rakuten.co.jp/dsearch/?f_query=${encodeURIComponent(`${keyword} ホテル`)}`
  return `https://hb.afl.rakuten.co.jp/hgc/${RAKUTEN_AFFILIATE_ID}/?pc=${encodeURIComponent(target)}`
}

// バリューコマース経由のアフィリエイトリンク（SIDは共通、PIDは提携先ごと）。
const VC_SID = '3771711'
const VC_PID_HOTPEPPER = '892675881'
const VC_PID_TABELOG = '892675885'
function valueCommerceUrl(pid, targetUrl) {
  return `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${VC_SID}&pid=${pid}&vc_url=${encodeURIComponent(targetUrl)}`
}
function tabelogSearchUrl(name, station) {
  const target = `https://tabelog.com/rstLst/?sk=${encodeURIComponent([name, station].filter(Boolean).join(' '))}`
  return valueCommerceUrl(VC_PID_TABELOG, target)
}

const faq = [
  ['掲載している店舗は本当に実在しますか？', 'はい。リクルートのホットペッパーグルメAPIから取得した実店舗データで、各店舗の禁煙・喫煙ポリシー（non_smoking情報）も公式データをそのまま表示しています。喫煙ポリシーは変更されることがあるため、来店前に「詳細を見る」リンクから最新情報をご確認ください。'],
  ['なぜ喫煙可能な店を紹介しているのですか？', '2020年の改正健康増進法により、多くの飲食店が原則屋内禁煙となりました。喫煙可能な店を探すのが難しくなったユーザー向けに、実際に喫煙できる店舗をまとめています。'],
  ['終電を逃したときはどうすればいいですか？', 'ページ上部の「終電を逃した方へ」から、最寄り駅名を入力して楽天トラベルでホテルを検索できます。'],
  ['夜のお仕事の求人情報はありますか？', '現在準備中です。実在しない求人を掲載して利用者を混乱させないよう、求人機能は正式な提携先が決まり次第、順次公開します。'],
  ['ユーザーは何を投稿できますか？', '来店レポート、営業時間や喫煙ルールの変更報告、写真、価格情報などを投稿できます。'],
]

function readArray(key) {
  try { return JSON.parse(localStorage.getItem(key)) ?? [] } catch { return [] }
}

function App() {
  const [query, setQuery] = useState('')
  const [area, setArea] = useState('すべて')
  const [category, setCategory] = useState('すべて')
  const [stationInput, setStationInput] = useState('')
  const [posts, setPosts] = useState(() => readArray(postKey))
  const [saved, setSaved] = useState(() => readArray(savedKey))
  const [form, setForm] = useState({ title: '', category: '来店レポート', body: '' })
  const areas = ['すべて', ...new Set(venues.map((item) => item.area))]
  const categories = ['すべて', ...new Set(venues.map((item) => item.category))]

  const filtered = useMemo(() => venues.filter((item) => {
    const text = [item.name, item.category, item.area, item.neighborhood, item.station, item.catch].join(' ')
    return text.includes(query)
      && (area === 'すべて' || item.area === area)
      && (category === 'すべて' || item.category === category)
  }), [query, area, category])

  function saveItem(id) {
    const next = saved.includes(id) ? saved.filter((item) => item !== id) : [...saved, id]
    setSaved(next)
    localStorage.setItem(savedKey, JSON.stringify(next))
  }

  function submitPost(event) {
    event.preventDefault()
    if (!form.title.trim() || !form.body.trim()) return
    const next = [{ ...form, id: crypto.randomUUID(), date: new Date().toLocaleDateString('ja-JP') }, ...posts]
    setPosts(next)
    localStorage.setItem(postKey, JSON.stringify(next))
    setForm({ title: '', category: '来店レポート', body: '' })
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <span className="brand">workbar.jp</span>
          <h1>喫煙OKバーナビ</h1>
          <p>全国21都市の喫煙可能なバー・居酒屋を、実店舗データで検索できるナビです。</p>
        </div>
        <aside className="answer-box">
          <small>AIによる要約</small>
          <strong>駅名や店名で検索すれば、実際に行ける喫煙可能な店がすぐに見つかります。</strong>
          <p>ホットペッパーグルメの実店舗データをもとに、禁煙・喫煙のポリシーもあわせて確認できます。</p>
        </aside>
      </section>

      <section className="lastTrain-cta" aria-label="終電を逃した方へ">
        <div>
          <h2>終電を逃した方へ</h2>
          <p>今すぐ泊まれるホテルを探しましょう。最寄り駅名を入れて検索できます。</p>
        </div>
        <form
          className="lastTrain-form"
          onSubmit={(event) => {
            event.preventDefault()
            window.open(rakutenHotelSearchUrl(stationInput || '東京'), '_blank', 'noopener,noreferrer')
          }}
        >
          <input
            value={stationInput}
            onChange={(event) => setStationInput(event.target.value)}
            placeholder="最寄り駅名（例: 渋谷）"
            inputMode="text"
          />
          <a
            className="lastTrain-button"
            href={rakutenHotelSearchUrl(stationInput || '東京')}
            target="_blank"
            rel="noopener noreferrer sponsored"
          >
            今すぐホテルを探す
          </a>
        </form>
        <p className="lastTrain-note">提供: 楽天トラベル</p>
      </section>

      <section className="ikyu-banner" aria-label="記念日のご予約">
        <a href="https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3771711&pid=892675884" rel="nofollow noopener noreferrer" target="_blank">
          <img src="https://ad.jp.ap.valuecommerce.com/servlet/gifbanner?sid=3771711&pid=892675884" height="1" width="1" border="0" alt="" />
          大切な記念日のご予約は、一休.comレストランで・・・。
        </a>
      </section>

      <section className="search-panel" aria-label="検索条件">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="店名・駅名・キーワードで検索" />
        <select value={area} onChange={(event) => setArea(event.target.value)}>
          {areas.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          {categories.map((item) => <option key={item}>{item}</option>)}
        </select>
      </section>

      <section className="summary-grid">
        <article><span>掲載都市数</span><strong>{areas.length - 1}</strong></article>
        <article><span>掲載店舗数</span><strong>{venues.length}</strong></article>
        <article><span>投稿数</span><strong>{posts.length}</strong></article>
        <article><span>保存数</span><strong>{saved.length}</strong></article>
      </section>

      <section className="content-grid">
        {filtered.map((item) => (
          <article className="card" key={item.id}>
            <div className="card-topline">
              <span>{item.area}{item.neighborhood ? ` / ${item.neighborhood}` : ''}</span>
              <span className="smoking-badge">{item.smokingPolicy}</span>
            </div>
            <h2>{item.name}</h2>
            {item.catch && <p>{item.catch}</p>}
            <div className="tag-row">
              <span>{item.category}</span>
              {item.station && <span>{item.station}駅</span>}
              {item.budget && <span>{item.budget}</span>}
            </div>
            {item.sourceUrl && (
              <p className="source-note">
                <a href={valueCommerceUrl(VC_PID_HOTPEPPER, item.sourceUrl)} target="_blank" rel="nofollow noopener noreferrer">詳細を見る（ホットペッパーグルメ）</a>
                {' '}/{' '}
                <a href={tabelogSearchUrl(item.name, item.station)} target="_blank" rel="nofollow noopener noreferrer">食べログで予約を探す</a>
              </p>
            )}
            <button type="button" onClick={() => saveItem(item.id)}>{saved.includes(item.id) ? '保存済み' : '保存する'}</button>
          </article>
        ))}
      </section>

      <section className="ugc-section">
        <h2>投稿・情報提供</h2>
        <p>実際に行ってみた感想や、営業時間・喫煙ルールが変わっていた場合の報告をお寄せください。最新の状態を保つために活用します。</p>
        <form className="ugc-form" onSubmit={submitPost}>
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="投稿タイトル" />
          <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
            {["来店レポート", "喫煙ルール変更", "営業時間変更", "写真投稿", "その他"].map((item) => <option key={item}>{item}</option>)}
          </select>
          <input value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="レポート・訂正情報・価格・現地メモ" />
          <button>投稿</button>
        </form>
        <div className="post-grid">
          {posts.length === 0 && <p className="empty-text">まだ投稿がありません。公開後は最初の投稿をお待ちしています。</p>}
          {posts.map((post) => <article key={post.id}><b>{post.title}</b><p>{post.body}</p><small>{post.category} / {post.date}</small></article>)}
        </div>
      </section>

      <section className="seo-section">
        <h2>よくある質問</h2>
        <div className="faq-grid">
          {faq.map(([question, answer]) => <article key={question}><h3>{question}</h3><p>{answer}</p></article>)}
        </div>
      </section>
    </main>
  )
}

export default App
