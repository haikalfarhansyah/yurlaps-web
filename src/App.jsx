import { useEffect, useRef, useState } from 'react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LayoutDashboard,
  LogIn,
  Mail,
  Menu,
  MessageCircle,
  Users,
  X,
} from 'lucide-react'
import { supabase } from './lib/supabase'
import DashboardPage from './DashboardPage'
import CommunityPage from './CommunityPage'
import ClubDashboardPage from './ClubDashboardPage'
import DesktopLoginPage from './DesktopLoginPage'
import DownloadPage from './DownloadPage'
import PublicClubPreview from './PublicClubPreview'

const gallery = [
  { src: '/gallery-transponder-size.png', alt: 'YURLAPS Transponder size comparison' },
]

const pageFromPath = (path = window.location.pathname) => {
  if (path === '/download') return 'download'
  if (path === '/desktop-login') return 'desktop-login'
  if (path === '/login') return 'login'
  if (path === '/dashboard') return 'dashboard'
  if (path === '/community') return 'community'
  if (path === '/public-club' || path.startsWith('/public-club/')) return 'public-club'
  if (path === '/club' || path.startsWith('/club/')) return 'club'
  return 'home'
}

const clubIdFromPath = (path = window.location.pathname) => {
  if (!path.startsWith('/club/') && !path.startsWith('/public-club/')) return null
  return path.split('/')[2] || null
}

function LoginPage({ text, onBack, onSignedIn, client = supabase, allowRegistration = true }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [mode, setMode] = useState('login')
  const [captchaToken, setCaptchaToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const captchaRef = useRef(null)
  const captchaSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY
  const captchaEnabled = Boolean(captchaSiteKey)

  useEffect(() => {
    if (!captchaSiteKey) return undefined
    let cancelled = false
    let intervalId

    const tryRender = () => {
      if (cancelled) return
      if (!window.turnstile) {
        intervalId = window.setInterval(tryRender, 300)
        return
      }
      const container = document.getElementById('yurlaps-captcha')
      if (!container || container.childElementCount > 0) return
      captchaRef.current = window.turnstile.render(container, {
        sitekey: captchaSiteKey,
        callback: (token) => setCaptchaToken(token),
        'expired-callback': () => setCaptchaToken(''),
        'error-callback': () => setCaptchaToken(''),
      })
    }

    tryRender()
    return () => {
      cancelled = true
      if (intervalId) window.clearInterval(intervalId)
      if (captchaRef.current && window.turnstile) {
        window.turnstile.remove(captchaRef.current)
        captchaRef.current = null
      }
    }
  }, [captchaSiteKey])

  const resetCaptcha = () => {
    setCaptchaToken('')
    if (captchaRef.current && window.turnstile) {
      window.turnstile.reset(captchaRef.current)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!client) {
      setError(text.supabaseMissing)
      return
    }
    if (!email.trim() || !password || (mode === 'register' && (!name.trim() || password !== confirmPassword))) {
      setError(mode === 'login' ? text.loginError : text.registerError)
      return
    }
    if (captchaEnabled && !captchaToken) {
      setError(text.captchaError)
      return
    }
    setLoading(true)
    setError('')
    const result = mode === 'login'
      ? await client.auth.signInWithPassword({
          email: email.trim(),
          password,
          options: { captchaToken },
        })
      : await client.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: `${window.location.origin}/login`,
            captchaToken,
          },
        })
    setLoading(false)
    if (result.error) {
      const message = result.error.message?.toLowerCase() || ''
      setError(message.includes('captcha') ? text.captchaFailed : result.error.message)
      resetCaptcha()
      return
    }
    if (mode === 'register' && !result.data.session) {
      const signInResult = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
        options: { captchaToken },
      })
      if (signInResult.error) {
        setError(text.registerConfirmRequired)
        resetCaptcha()
        return
      }
      onSignedIn(signInResult.data.session, true)
      return
    }
    onSignedIn(result.data.session, mode === 'register')
  }

  return (
    <main className="relative flex min-h-[calc(100vh-5rem)] items-center justify-center overflow-hidden px-5 py-16 sm:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(74,164,255,0.2),transparent_38%),linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)]" />
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-[0_24px_80px_rgba(7,88,216,0.12)] lg:grid-cols-[0.85fr_1.15fr]">
        <div className="hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <img src="/yurlaps-logo-transparent.png" alt="YurLaps" className="h-14 w-36 object-contain object-left" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-300">YurLaps</p>
            <h1 className="mt-4 max-w-sm font-display text-5xl font-extrabold leading-[0.95] tracking-[-0.07em]">{mode === 'login' ? text.loginTitle : text.registerTitle}</h1>
            <p className="mt-5 max-w-sm text-base leading-7 text-slate-300">{text.loginSubtitle}</p>
          </div>
        </div>
        <div className="relative p-7 sm:p-10 lg:p-12">
          <button type="button" onClick={onBack} className="mb-10 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-ocean">
            <ChevronLeft size={17} /> {text.loginBack}
          </button>
          <div className="lg:hidden">
            <img src="/yurlaps-logo-transparent.png" alt="YurLaps" className="h-12 w-32 object-contain object-left" />
            <p className="mt-8 text-xs font-bold uppercase tracking-[0.22em] text-ocean">YurLaps</p>
          </div>
          <h1 className="mt-4 font-display text-4xl font-extrabold tracking-[-0.07em] text-ink sm:text-5xl">{mode === 'login' ? text.loginTitle : text.registerTitle}</h1>
          <p className="mt-4 max-w-md text-base leading-7 text-slate-500">{text.loginSubtitle}</p>
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {mode === 'register' && <label className="block">
              <span className="mb-2 block text-sm font-bold text-ink">{text.fullName}</span>
              <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" autoComplete="name" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-ocean focus:bg-white focus:ring-4 focus:ring-blue-100" />
            </label>}
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-ink">{text.email}</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-ocean focus:bg-white focus:ring-4 focus:ring-blue-100" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-ink">{text.password}</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-ocean focus:bg-white focus:ring-4 focus:ring-blue-100" />
            </label>
            {mode === 'register' && <label className="block">
              <span className="mb-2 block text-sm font-bold text-ink">{text.confirmPassword}</span>
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="••••••••" autoComplete="new-password" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-ocean focus:bg-white focus:ring-4 focus:ring-blue-100" />
            </label>}
            {captchaEnabled && <div id="yurlaps-captcha" className="min-h-[65px]" />}
            {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600" role="alert">{error}</p>}
            <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-ocean px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#1855db] disabled:cursor-wait disabled:opacity-60">
              {loading ? text.loading : mode === 'login' ? text.loginSubmit : text.registerSubmit} <LogIn size={17} />
            </button>
          </form>
          {allowRegistration && <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); resetCaptcha() }} className="mt-6 w-full text-center text-sm font-bold text-ocean transition hover:text-[#1855db]">
            {mode === 'login' ? text.noAccount : text.haveAccount}
          </button>}
        </div>
      </div>
    </main>
  )
}

function App() {
  const [isLoading, setIsLoading] = useState(true)
  const [language, setLanguage] = useState('en')
  const [languageOpen, setLanguageOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeProduct, setActiveProduct] = useState(0)
  const [contactOpen, setContactOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(pageFromPath)
  const [clubId, setClubId] = useState(clubIdFromPath)
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [signupSuccessOpen, setSignupSuccessOpen] = useState(false)
  const [redirectTarget, setRedirectTarget] = useState(null)
  const [clubMembership, setClubMembership] = useState(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 1800)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true)
      return undefined
    }
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session)
        setAuthReady(true)
      }
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !session) {
      setClubMembership(null)
      return undefined
    }
    let active = true
    supabase
      .from('club_members')
      .select('club_id, role, status')
      .eq('user_id', session.user.id)
      .eq('status', 'active')
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setClubMembership(data || null)
      })
    return () => {
      active = false
    }
  }, [session?.user?.id, currentPage])

  useEffect(() => {
    if (!authReady || session) return
    if (currentPage !== 'dashboard' && !(currentPage === 'club' && !clubId)) return
    setRedirectTarget(window.location.pathname)
    window.history.replaceState({}, '', '/login')
    setCurrentPage('login')
  }, [authReady, currentPage, session, clubId])

  const copy = {
    en: {
      home: 'Home',
      product: 'Product',
      gallery: 'Gallery',
      community: 'Community',
      contact: 'Contact',
      language: 'Language',
      headline: 'SMALL, LIGHT, AFFORDABLE, AND ACCURATE.',
      intro: 'A solution for your RC.',
      aboutText:
        'Precision lap timing and race management technology designed for radio-controlled racing. Track every lap, measure performance, and manage your race with confidence.',
      decoderName: 'YURLAPS DECODER',
      decoderTagline: 'Accurate Detection. Reliable Timing. Seamless Integration.',
      decoderDescription:
        'The YURLAPS Decoder is the core of the YURLAPS timing system. Designed to receive and process signals from YURLAPS transponders, it accurately identifies passing vehicles and delivers timing data to the race management software. With flexible deployment options, YURLAPS can operate through YURLAPS Host or a PC/Laptop.',
      decoderDetails: 'System integration',
      decoderDetailsValue: 'YURLAPS Host or PC/Laptop',
      hostName: 'YURLAPS HOST',
      hostDescription:
        'YURLAPS Host is a dedicated computing unit designed to replace a conventional computer in the YURLAPS timing system. Built for continuous operation, it provides a reliable and compact platform for running an online RC racing timing system 24 hours. With built-in Wi-Fi and web-based access, users can monitor and manage their races directly from a mobile phone, tablet, or laptop without installing dedicated software. Its Bluetooth connectivity supports external speakers for race announcements, while HDMI output allows race information to be displayed on a TV or monitor. The integrated 1.3-inch LCD provides essential system information.',
      hostDetails: 'Product details',
      hostDetailsValue: 'Coming soon',
      hostPrice: 'Coming soon',
      decoderPrice: 'IDR 2,500,000',
      decoderPoPrice: 'IDR 1,500,000',
      transponderPrice: 'IDR 450,000',
      transponderPoPrice: 'IDR 350,000',
      transponderName: 'YURLAPS TRANSPONDER',
      transponderDescription:
        'YURLAPS Transponder is a compact and lightweight active timing device designed for precision RC racing. Using magnetic coupling technology, it continuously transmits a unique 7-digit Personal ID, allowing the timing system to identify vehicles as they pass over the detection loop. Built for demanding racing environments, its waterproof construction and compact design make it easy to install in a wide range of RC vehicles.',
      transponderDetails: 'Product details',
      transponderSize: 'Size',
      transponderSizeValue: '17 × 20 mm',
      transponderData: 'Driving records',
      transponderDataValue: 'Practice and race · Online coming soon',
      transponderStock: 'Coming soon',
      transponderStockNote: 'YURLAPS account integration',
      productName: 'YURLAPS DETECTION LOOP',
      productTagline: 'WIDE TRACK COVERAGE. RELIABLE DETECTION.',
      productDescription:
        'Designed to deliver reliable transponder detection across wide RC racing tracks. The YURLAPS Detection Loop supports track widths of up to 10 meters and comes with a 10-meter coaxial cable for convenient connection to the decoder.',
      stock: 'Included with decoder',
      stockNote: 'Built for RC racing tracks',
      details: 'Product details',
      span: 'Maximum track span',
      cable: 'Coaxial cable',
      connection: 'Connection',
      spanValue: '10M',
      cableValue: '10M',
      connectionValue: 'YURLAPS decoder',
      benefitTitle: 'Made for clean, reliable timing.',
      benefit1Title: 'Simple installation',
      benefit1Text: 'Embed it into the track, place it above the surface, or suspend it overhead.',
      benefit2Title: 'Wide detection',
      benefit2Text: 'A single loop spans up to 5M across the track to capture passing transponders.',
      benefit3Title: 'Ready to connect',
      benefit3Text: 'The 10M coaxial cable gives you room to position the loop and reach the decoder.',
      galleryTitle: 'See it in the real world.',
      galleryText: 'At our core, we are small, light, affordable, and accurate.',
      contactTitle: 'Bring accurate timing to your track.',
      contactText: 'Tell us about your setup, and we will help you get started with YURLAPS.',
      contactButton: 'Contact us',
      login: 'Login',
      logout: 'Logout',
      loginTitle: 'Welcome back.',
      loginSubtitle: 'Sign in with your email and password to continue to your YurLaps account.',
      email: 'Email',
      password: 'Password',
      loginSubmit: 'Login',
      loginBack: 'Back to YurLaps',
      loginError: 'Please enter your email and password.',
      loginComingSoon: 'The login service will be connected soon.',
      registerTitle: 'Create your account.',
      registerSubmit: 'Create account',
      registerError: 'Please enter your name, email, and password.',
      registerConfirmRequired: 'Account created, but email confirmation is still enabled. Disable "Confirm email" in Supabase Auth settings so new accounts are verified automatically.',
      signedInAs: 'Signed in as',
      personalDashboard: 'Personal dashboard',
      signupSuccessTitle: 'Account created successfully',
      signupSuccessText: 'Your account is verified and ready to use. Welcome to YurLaps.',
      signupSuccessDashboard: 'Open personal dashboard',
      signupSuccessClose: 'Back to home',
      clubDashboard: 'Dashboard club',
      myClub: 'My club',
      captchaFailed: 'CAPTCHA verification failed. Please complete it again and retry.',
      fullName: 'Full name',
      noAccount: 'New to YurLaps? Create an account',
      haveAccount: 'Already have an account? Login',
      loading: 'Please wait...',
      supabaseMissing: 'Supabase is not configured. Add the VITE environment variables first.',
      confirmPassword: 'Confirm password',
      captchaError: 'Please complete the CAPTCHA before continuing.',
      account: 'Your YurLaps account is ready.',
      footer: 'Small, light, affordable, and accurate.',
      back: 'Back to top',
      splash: 'SMALL, LIGHT, AFFORDABLE, AND ACCURATE.',
    },
    id: {
      home: 'Beranda',
      product: 'Produk',
      gallery: 'Galeri',
      community: 'Community',
      contact: 'Kontak',
      language: 'Bahasa',
      headline: 'KECIL, RINGAN, TERJANGKAU, DAN AKURAT.',
      intro: 'Solusi untuk RC-mu.',
      aboutText:
        'Teknologi pencatatan waktu lap dan manajemen balap yang presisi untuk balap radio-controlled. Pantau setiap lap, ukur performa, dan kelola balapan dengan percaya diri.',
      decoderName: 'YURLAPS DECODER',
      decoderTagline: 'Deteksi Akurat. Timing Andal. Integrasi Tanpa Batas.',
      decoderDescription:
        'YURLAPS Decoder adalah inti dari sistem timing YURLAPS. Dirancang untuk menerima dan memproses sinyal dari transponder YURLAPS, perangkat ini mengenali kendaraan yang melintas secara akurat dan mengirimkan data timing ke software manajemen balap. Dengan opsi penggunaan yang fleksibel, YURLAPS dapat beroperasi melalui YURLAPS Host atau PC/Laptop.',
      decoderDetails: 'Integrasi sistem',
      decoderDetailsValue: 'YURLAPS Host atau PC/Laptop',
      hostName: 'YURLAPS HOST',
      hostDescription:
        'YURLAPS Host adalah unit komputasi khusus yang dirancang untuk menggantikan komputer konvensional dalam sistem timing YURLAPS. Dibuat untuk operasi berkelanjutan, perangkat ini menyediakan platform yang andal dan ringkas untuk menjalankan sistem timing balap RC online selama 24 jam. Dengan Wi-Fi bawaan dan akses berbasis web, pengguna dapat memantau serta mengelola balapan langsung dari ponsel, tablet, atau laptop tanpa memasang software khusus. Konektivitas Bluetooth mendukung speaker eksternal untuk pengumuman balap, sementara output HDMI memungkinkan informasi balapan ditampilkan di TV atau monitor. LCD terintegrasi 1,3 inci menampilkan informasi sistem penting.',
      hostDetails: 'Detail produk',
      hostDetailsValue: 'Segera hadir',
      hostPrice: 'Segera hadir',
      decoderPrice: 'IDR 2.500.000',
      decoderPoPrice: 'IDR 1.500.000',
      transponderPrice: 'IDR 450.000',
      transponderPoPrice: 'IDR 350.000',
      transponderName: 'YURLAPS TRANSPONDER',
      transponderDescription:
        'YURLAPS Transponder adalah perangkat timing aktif yang ringkas dan ringan, dirancang untuk balap RC dengan presisi tinggi. Menggunakan teknologi magnetic coupling, perangkat ini terus mengirimkan Personal ID unik 7 digit sehingga sistem timing dapat mengenali kendaraan saat melewati detection loop. Dibuat untuk lingkungan balap yang menuntut, konstruksi tahan air dan desainnya yang ringkas membuatnya mudah dipasang pada berbagai jenis kendaraan RC.',
      transponderDetails: 'Detail produk',
      transponderSize: 'Ukuran',
      transponderSizeValue: '17 × 20 mm',
      transponderData: 'Rekam data mengemudi',
      transponderDataValue: 'Practice dan race · Online segera hadir',
      transponderStock: 'Segera hadir',
      transponderStockNote: 'Integrasi akun YURLAPS',
      productName: 'YURLAPS DETECTION LOOP',
      productTagline: 'CAKUPAN LINTASAN LEBAR. DETEKSI ANDAL.',
      productDescription:
        'Dirancang untuk memberikan deteksi transponder yang andal di lintasan balap RC yang lebar. YURLAPS Detection Loop mendukung lebar lintasan hingga 10 meter dan dilengkapi kabel coaxial 10 meter untuk koneksi praktis ke decoder.',
      stock: 'Termasuk saat membeli decoder',
      stockNote: 'Dibuat untuk lintasan balap RC',
      details: 'Detail produk',
      span: 'Lebar lintasan maksimum',
      cable: 'Kabel coaxial',
      connection: 'Koneksi',
      spanValue: '10M',
      cableValue: '10M',
      connectionValue: 'Decoder YURLAPS',
      benefitTitle: 'Dibuat untuk timing yang bersih dan andal.',
      benefit1Title: 'Pemasangan sederhana',
      benefit1Text: 'Tanam di lintasan, letakkan di atas permukaan, atau gantung di atas lintasan.',
      benefit2Title: 'Deteksi lebar',
      benefit2Text: 'Satu loop menjangkau hingga 5M untuk menangkap transponder yang melintas.',
      benefit3Title: 'Siap terhubung',
      benefit3Text: 'Kabel coaxial 10M memberi ruang untuk menempatkan loop dan menjangkau decoder.',
      galleryTitle: 'Lihat dalam penggunaan nyata.',
      galleryText: 'Inti dari kami adalah kecil, ringan, terjangkau, dan akurat.',
      contactTitle: 'Hadirkan timing akurat ke lintasanmu.',
      contactText: 'Ceritakan setup-mu, dan kami akan membantu memulai dengan YURLAPS.',
      contactButton: 'Hubungi kami',
      login: 'Login',
      logout: 'Keluar',
      loginTitle: 'Selamat datang kembali.',
      loginSubtitle: 'Masuk menggunakan email dan password untuk melanjutkan ke akun YurLaps.',
      email: 'Email',
      password: 'Password',
      loginSubmit: 'Masuk',
      loginBack: 'Kembali ke YurLaps',
      loginError: 'Silakan isi email dan password.',
      loginComingSoon: 'Layanan login akan segera terhubung.',
      registerTitle: 'Buat akunmu.',
      registerSubmit: 'Buat akun',
      registerError: 'Silakan isi nama, email, dan password.',
      registerConfirmRequired: 'Akun berhasil dibuat, tetapi konfirmasi email masih aktif di Supabase. Nonaktifkan "Confirm email" pada pengaturan Supabase Auth agar akun baru otomatis terverifikasi.',
      signedInAs: 'Masuk sebagai',
      personalDashboard: 'Dashboard personal',
      signupSuccessTitle: 'Akun berhasil dibuat',
      signupSuccessText: 'Akunmu sudah terverifikasi dan siap digunakan. Selamat datang di YurLaps.',
      signupSuccessDashboard: 'Buka dashboard personal',
      signupSuccessClose: 'Kembali ke beranda',
      clubDashboard: 'Dashboard club',
      myClub: 'My club',
      captchaFailed: 'Verifikasi CAPTCHA gagal. Selesaikan lagi lalu coba ulang.',
      fullName: 'Nama lengkap',
      noAccount: 'Belum punya akun YurLaps? Buat akun',
      haveAccount: 'Sudah punya akun? Masuk',
      loading: 'Tunggu sebentar...',
      supabaseMissing: 'Supabase belum dikonfigurasi. Tambahkan environment variable VITE terlebih dahulu.',
      confirmPassword: 'Konfirmasi password',
      captchaError: 'Selesaikan CAPTCHA sebelum melanjutkan.',
      account: 'Akun YurLaps kamu sudah siap.',
      footer: 'Kecil, ringan, terjangkau, dan akurat.',
      back: 'Kembali ke atas',
      splash: 'KECIL, RINGAN, TERJANGKAU, DAN AKURAT.',
    },
  }

  const text = copy[language]

  useEffect(() => {
    const handlePopState = () => {
      setClubId(clubIdFromPath())
      setCurrentPage(pageFromPath())
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigateTo = (path) => {
    setMenuOpen(false)
    window.history.pushState({}, '', path)
    setClubId(clubIdFromPath(path))
    setCurrentPage(pageFromPath(path))
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const openLogin = () => navigateTo('/login')

  const goHome = () => {
    setRedirectTarget(null)
    navigateTo('/')
  }

  const goDashboard = () => navigateTo('/dashboard')

  const openCommunity = () => navigateTo('/community')

  const openClub = (id) => navigateTo(id && !session ? `/public-club/${id}` : (id ? `/club/${id}` : '/club'))

  const openDashboard = () => {
    if (!session) {
      openLogin()
      return
    }
    goDashboard()
  }

  const openClubDashboard = () => {
    if (!session) {
      openLogin()
      return
    }
    openClub(clubMembership?.club_id || null)
  }

  const handleRequireLogin = () => {
    setRedirectTarget('/community')
    openLogin()
  }

  const handleSignedIn = (nextSession, justRegistered = false) => {
    if (nextSession) setSession(nextSession)
    if (justRegistered) {
      setRedirectTarget(null)
      goHome()
      setSignupSuccessOpen(true)
      return
    }
    const target = redirectTarget
    setRedirectTarget(null)
    if (target) {
      navigateTo(target)
      return
    }
    goHome()
  }

  const handleSignOut = async () => {
    if (supabase) await supabase.auth.signOut()
    setSignupSuccessOpen(false)
    goHome()
  }

  const scrollTo = (id) => {
    setMenuOpen(false)
    if (currentPage !== 'home') {
      goHome()
      window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
      }, 80)
      return
    }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const openContact = () => {
    setMenuOpen(false)
    setContactOpen(true)
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fbfdff] text-ink">
      <div className={`fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-slate-950 transition-all duration-700 ${isLoading ? 'visible opacity-100' : 'pointer-events-none invisible opacity-0'}`}>
        <img src="/splash-background.png" alt="" className="absolute inset-0 h-full w-full object-cover [clip-path:inset(0_0_0_50%)]" />
        <img src="/splash-background-rally.png" alt="" className="absolute inset-0 h-full w-full object-cover [clip-path:inset(0_50%_0_0)]" />
        <div className="absolute inset-y-0 left-1/2 w-1/2 -translate-x-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent blur-[34px]" />
        <div className="absolute inset-0 bg-slate-950/60" />
        <div className="relative flex w-full max-w-sm flex-col items-center px-8">
          <img src="/yurlaps-logo-transparent.png" alt="YurLaps" className="relative w-72 animate-[splash-logo_1.2s_ease-out_both] object-contain sm:w-80" />
          <div className="mt-8 h-px w-32 overflow-hidden bg-white/35"><div className="h-full w-full origin-left animate-[splash-progress_1.65s_ease-in-out_both] bg-ocean" /></div>
          <p className="mt-4 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-white/85">{text.splash}</p>
        </div>
      </div>

      <header className="sticky top-0 z-50 border-b border-blue-100 bg-white shadow-[0_8px_24px_rgba(7,88,216,0.1)]">
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <div className="navbar-wave navbar-wave-one" />
          <div className="navbar-wave navbar-wave-two" />
        </div>
        <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-2 sm:px-8">
          <button onClick={() => scrollTo('home')} className="group flex items-center" aria-label="YurLaps home">
            <img src="/yurlaps-logo-transparent.png" alt="YurLaps" className="h-11 w-[7.2rem] object-contain transition-transform group-hover:-rotate-2" />
          </button>
          <div className="hidden items-center gap-1 md:flex">
            {[['home', text.home], ['products', text.product], ['gallery', text.gallery], ['community', text.community], ['contact', text.contact]].map(([id, label]) => (
              <button key={id} onClick={() => (id === 'community' ? openCommunity() : scrollTo(id))} className="rounded-full px-3.5 py-2 text-sm font-bold text-slate-600 transition hover:bg-blue-50 hover:text-ocean">{label}</button>
            ))}
            <div className="relative ml-1">
              <button onClick={() => setLanguageOpen(!languageOpen)} className="flex items-center gap-1 rounded-full px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-600 hover:bg-blue-50 hover:text-ocean">{language.toUpperCase()} <ChevronDown size={13} className={languageOpen ? 'rotate-180' : ''} /></button>
              {languageOpen && <div className="absolute right-0 top-full z-30 mt-2 w-32 rounded-2xl border border-slate-100 bg-white p-1.5 shadow-card">{[['en', 'English'], ['id', 'Indonesia']].map(([value, label]) => <button key={value} onClick={() => { setLanguage(value); setLanguageOpen(false) }} className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold ${language === value ? 'bg-mist text-ocean' : 'text-slate-500 hover:bg-slate-50'}`}>{label}{language === value && <Check size={14} />}</button>)}</div>}
            </div>
          </div>
          {session ? <button onClick={handleSignOut} className="hidden items-center gap-2 rounded-full bg-slate-100 px-4 py-2.5 text-sm font-semibold text-ocean transition hover:bg-blue-100 md:flex">{session.user.email} · {text.logout}</button> : <button onClick={openLogin} className="hidden items-center gap-2 rounded-full bg-ocean px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1855db] md:flex">{text.login} <LogIn size={16} /></button>}
          <button onClick={() => setMenuOpen(!menuOpen)} className="rounded-full p-2 text-slate-700 hover:bg-blue-50 md:hidden" aria-label="Toggle menu">{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
        </nav>
        <a href="/download" className="block border-t border-blue-100 px-5 py-2 text-center text-sm font-bold text-ocean">Download YurLaps untuk Windows</a>
        {menuOpen && <div className="relative z-10 border-t border-blue-100 bg-white/95 px-5 py-3 backdrop-blur-md md:hidden">{[['home', text.home], ['products', text.product], ['gallery', text.gallery], ['community', text.community], ['contact', text.contact]].map(([id, label]) => <button key={id} onClick={() => (id === 'community' ? openCommunity() : scrollTo(id))} className="block w-full rounded-xl px-3 py-3 text-left text-sm font-bold text-slate-600 hover:bg-blue-50">{label}</button>)}{session ? <button onClick={handleSignOut} className="mt-2 flex w-full items-center justify-center rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-ocean">{text.logout}</button> : <button onClick={openLogin} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-ocean px-4 py-3 text-sm font-bold text-white">{text.login} <LogIn size={16} /></button>}<div className="mt-2 flex gap-2 border-t border-blue-100 pt-3">{[['en', 'EN'], ['id', 'ID']].map(([value, label]) => <button key={value} onClick={() => setLanguage(value)} className={`rounded-full px-4 py-2 text-xs font-bold ${language === value ? 'bg-ocean text-white' : 'bg-blue-50 text-slate-500'}`}>{label}</button>)}</div></div>}
        {session && currentPage !== 'dashboard' && currentPage !== 'club' && (
          <div className="relative z-[5] border-t border-blue-100 bg-mist/80">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-2.5 sm:px-8">
              <span className="min-w-0 truncate text-xs font-semibold text-slate-500">
                {text.signedInAs}{' '}
                <span className="font-bold text-ink">
                  {session.user.user_metadata?.full_name || session.user.email}
                </span>
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {clubMembership && (
                  <button
                    type="button"
                    onClick={openClubDashboard}
                    className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-ocean shadow-sm transition hover:bg-blue-50"
                  >
                    <Users size={15} />
                    {['leader', 'co_leader', 'officer'].includes(clubMembership.role)
                      ? text.clubDashboard
                      : text.myClub}
                  </button>
                )}
                <button
                  type="button"
                  onClick={openDashboard}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-ocean px-4 py-2 text-xs font-bold text-white transition hover:bg-[#1855db]"
                >
                  <LayoutDashboard size={15} /> {text.personalDashboard}
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {currentPage === 'download' ? (
        <DownloadPage />
      ) : currentPage === 'desktop-login' ? (
        <DesktopLoginPage LoginPage={LoginPage} text={text} onBack={goHome} />
      ) : currentPage === 'login' ? (
        <LoginPage text={text} onBack={goHome} onSignedIn={handleSignedIn} />
      ) : currentPage === 'dashboard' ? (
        session ? (
          <DashboardPage
            session={session}
            language={language}
            onBack={goHome}
            onSignOut={handleSignOut}
          />
        ) : (
          <main className="grid min-h-[60vh] place-items-center px-5">
            <p className="text-sm font-semibold text-slate-500">{text.loading}</p>
          </main>
        )
      ) : currentPage === 'community' ? (
        <CommunityPage
          session={session}
          language={language}
          onBack={goHome}
          onRequireLogin={handleRequireLogin}
          onOpenClub={openClub}
          onOpenPublicClub={(id) => navigateTo(`/public-club/${id}`)}
        />
      ) : currentPage === 'public-club' ? (
        <PublicClubPreview clubId={clubId} language={language} onBack={openCommunity} />
      ) : currentPage === 'club' ? (
        session ? (
          <ClubDashboardPage
            session={session}
            language={language}
            clubId={clubId}
            onBack={openCommunity}
            onOpenCommunity={openCommunity}
            onSignOut={handleSignOut}
            onSelectClub={(id) => openClub(id)}
          />
        ) : clubId ? (
          <PublicClubPreview clubId={clubId} language={language} onBack={openCommunity} />
        ) : (
          <main className="grid min-h-[60vh] place-items-center px-5">
            <p className="text-sm font-semibold text-slate-500">{text.loading}</p>
          </main>
        )
      ) : <>
      <main>
        <section id="home" className="pb-24 pt-20 lg:pb-32 lg:pt-28">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <p className="mb-5 text-center text-base font-bold uppercase tracking-[0.24em] text-ocean sm:text-lg">{text.intro}</p>
          </div>
          <div className="relative isolate flex min-h-[19rem] w-full items-center justify-center overflow-hidden bg-ink px-5 py-10 sm:min-h-[23rem] sm:px-8 sm:py-12 lg:min-h-[27rem] lg:px-10 lg:py-14">
            <img src="/splash-background-rally.png" alt="" className="absolute inset-y-0 left-0 h-full w-1/2 object-cover object-center" />
            <img src="/splash-background.png" alt="" className="absolute inset-y-0 right-0 h-full w-1/2 object-cover object-center" />
            <div className="absolute inset-0 bg-slate-950/45" />
            <div className="absolute inset-y-0 left-1/2 w-1/2 -translate-x-1/2 bg-gradient-to-r from-transparent via-slate-950/45 to-transparent blur-3xl" />
            <div className="mx-auto max-w-6xl px-0 sm:px-0">
              <h1 className="relative mx-auto w-full max-w-5xl text-center font-display text-5xl font-extrabold leading-[0.94] tracking-[-0.08em] text-white drop-shadow-lg sm:text-6xl lg:text-[6.5rem]">{text.headline}</h1>
            </div>
          </div>
          <div className="mx-auto mt-14 max-w-6xl px-5 sm:px-8">
            <div className="rounded-[2rem] border border-blue-100 bg-blue-50/70 px-7 py-10 sm:px-12 lg:px-16 lg:py-14">
              <p className="animate-[about-copy_1s_cubic-bezier(0.22,1,0.36,1)_both] mt-4 max-w-3xl font-display text-3xl font-extrabold leading-[1.05] tracking-[-0.06em] text-ink sm:text-5xl">{text.aboutText}</p>
            </div>
          </div>
          <div id="products" className="mx-auto mt-14 max-w-6xl px-5 sm:px-8">
            <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white">
              <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
                <div className="product-wave product-wave-one" />
                <div className="product-wave product-wave-two" />
              </div>
              <button type="button" onClick={() => { setActiveProduct((activeProduct + 3) % 4) }} className={`absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/90 p-2 text-ocean shadow-md transition hover:bg-blue-50`} aria-label="Previous product"><ChevronLeft size={20} /></button>
              <button type="button" onClick={() => { setActiveProduct((activeProduct + 1) % 4) }} className={`absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/90 p-2 text-ocean shadow-md transition hover:bg-blue-50`} aria-label="Next product"><ChevronRight size={20} /></button>
              <div className="relative z-10 flex min-h-[30rem] flex-col items-center gap-8 px-12 py-10 sm:px-20">
                {activeProduct === 0 && <>
                  <button type="button" className={`group text-center transition-transform duration-300 ease-out will-change-transform lg:col-span-2 w-full max-w-xl lg:w-[34rem]`}>
                    <img src="/decoder-example.png" alt={`${text.decoderName} example`} className="h-[22rem] w-full object-contain transition duration-500 group-hover:scale-[1.02] sm:h-[28rem]" />
                    <h2 className="mt-5 font-display text-3xl font-extrabold leading-[0.98] tracking-[-0.07em] transition-colors group-hover:text-ocean sm:text-5xl">{text.decoderName}</h2>
                  </button>
                  {activeProduct === 0 && <><div className="product-details flex max-h-[82vh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-3xl border border-blue-100 bg-white p-6 pt-16 shadow-2xl animate-[product-modal-in_0.3s_ease-out_both] sm:w-[calc(100%-4rem)] sm:p-8 lg:max-w-4xl lg:flex-row lg:items-center lg:gap-8 lg:overflow-y-auto lg:p-10"><div className="min-w-0"><p className="text-lg font-semibold leading-8 text-ocean">{text.decoderTagline}</p><p className="mt-5 text-lg leading-8 text-slate-600">{text.decoderDescription}</p><div className="mt-7 border-y border-slate-200"><div className="flex items-center justify-between border-b border-slate-100 py-3 text-sm"><span className="text-slate-400">{text.decoderDetails}</span><strong className="max-w-[65%] text-right text-ink">{text.decoderDetailsValue}</strong></div><div className="flex items-center justify-between py-3 text-sm"><span className="text-slate-400">Price</span><strong className="text-right"><span className="mr-2 text-slate-400 line-through">{text.decoderPrice}</span><span className="text-emerald-600">PREORDER {text.decoderPoPrice}</span></strong></div></div></div></div></>}
                </>}
                {activeProduct === 1 && <>
                  <button type="button" className={`group text-center transition-transform duration-300 ease-out will-change-transform lg:col-span-2 w-full max-w-xl lg:w-[34rem]`}>
                    <img src="/yurlaps-host.png" alt={text.hostName} className="h-[22rem] w-full object-contain transition duration-500 group-hover:scale-[1.02] sm:h-[28rem]" />
                    <h2 className="mt-5 font-display text-3xl font-extrabold leading-[0.98] tracking-[-0.07em] transition-colors group-hover:text-ocean sm:text-5xl">{text.hostName}</h2>
                  </button>
                  {activeProduct === 1 && <><div className="product-details flex max-h-[82vh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-3xl border border-blue-100 bg-white p-6 pt-16 shadow-2xl animate-[product-modal-in_0.3s_ease-out_both] sm:w-[calc(100%-4rem)] sm:p-8 lg:max-w-4xl lg:flex-row lg:items-center lg:gap-8 lg:overflow-y-auto lg:p-10"><div className="min-w-0"><p className="text-lg leading-8 text-slate-600">{text.hostDescription}</p><div className="mt-7 border-y border-slate-200"><div className="flex items-center justify-between py-3 text-sm"><span className="text-slate-400">{text.hostDetails}</span><strong className="text-right text-ink">{text.hostDetailsValue}</strong></div><div className="flex items-center justify-between border-t border-slate-100 py-3 text-sm"><span className="text-slate-400">Price</span><strong className="text-right text-ink">{text.hostPrice}</strong></div></div></div></div></>}
                </>}
                {activeProduct === 2 && <>
                  <button type="button" className={`group text-center transition-transform duration-300 ease-out will-change-transform lg:col-span-2 w-full max-w-xl lg:w-[34rem]`}>
                    <img src="/yurlaps-transponder.png" alt={text.transponderName} className="h-[22rem] w-full object-contain transition duration-500 group-hover:scale-[1.02] sm:h-[28rem]" />
                    <h2 className="mt-5 font-display text-3xl font-extrabold leading-[0.98] tracking-[-0.07em] transition-colors group-hover:text-ocean sm:text-5xl">{text.transponderName}</h2>
                  </button>
                  {activeProduct === 2 && <><div className="product-details flex max-h-[82vh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-3xl border border-blue-100 bg-white p-6 pt-16 shadow-2xl animate-[product-modal-in_0.3s_ease-out_both] sm:w-[calc(100%-4rem)] sm:p-8 lg:max-w-4xl lg:flex-row lg:items-center lg:gap-8 lg:overflow-y-auto lg:p-10"><div className="min-w-0 self-start lg:pt-12"><p className="text-lg leading-8 text-slate-600">{text.transponderDescription}</p><div className="mt-7 border-y border-slate-200"><p className="border-b border-slate-100 py-3 text-xs font-bold uppercase tracking-[0.18em] text-ocean">{text.transponderDetails}</p>{[[text.transponderSize, text.transponderSizeValue], [text.transponderData, text.transponderDataValue]].map(([label, value]) => <div key={label} className="flex items-center justify-between border-b border-slate-100 py-3 text-sm last:border-b-0"><span className="text-slate-400">{label}</span><strong className="max-w-[65%] text-right text-ink">{value}</strong></div>)}<div className="flex items-center justify-between border-t border-slate-100 py-3 text-sm"><span className="text-slate-400">Price</span><strong className="max-w-[65%] text-right"><span className="mr-2 text-slate-400 line-through">{text.transponderPrice}</span><span className="text-emerald-600">PREORDER {text.transponderPoPrice}</span></strong></div></div><div className="mt-8 flex items-center justify-between border-y border-slate-200 py-4 text-sm"><div><p className="font-semibold text-ink">{text.transponderStock}</p><p className="mt-1 text-slate-400">{text.transponderStockNote}</p></div><span className="h-2.5 w-2.5 rounded-full bg-blue-400" /></div></div></div></>}
                </>}
                {activeProduct === 3 && <>
                  <button type="button" className={`group text-center transition-transform duration-300 ease-out will-change-transform lg:col-span-2 w-full max-w-xl lg:w-[34rem]`}>
                    <img src="/yurlaps-bridge.png" alt={text.productName} className="h-[22rem] w-full object-contain transition duration-500 group-hover:scale-[1.02] sm:h-[28rem]" />
                    <h2 className="mt-5 font-display text-3xl font-extrabold leading-[0.98] tracking-[-0.07em] transition-colors group-hover:text-ocean sm:text-5xl">{text.productName}</h2>
                  </button>
                  {activeProduct === 3 && <><div className="product-details flex max-h-[82vh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-3xl border border-blue-100 bg-white p-6 pt-16 shadow-2xl animate-[product-modal-in_0.3s_ease-out_both] sm:w-[calc(100%-4rem)] sm:p-8 lg:max-w-4xl lg:flex-row lg:items-center lg:gap-8 lg:overflow-y-auto lg:p-10"><div className="min-w-0"><p className="text-lg font-semibold leading-8 text-ocean">{text.productTagline}</p><p className="mt-5 text-lg leading-8 text-slate-600">{text.productDescription}</p><div className="mt-7 border-y border-slate-200">{[[text.span, text.spanValue], [text.cable, text.cableValue], [text.connection, text.connectionValue]].map(([label, value]) => <div key={label} className="flex items-center justify-between border-b border-slate-100 py-3 text-sm last:border-b-0"><span className="text-slate-400">{label}</span><strong className="text-right text-ink">{value}</strong></div>)}</div><div className="mt-8 flex items-center justify-between border-y border-slate-200 py-4 text-sm"><div><p className="font-semibold text-ink">{text.stock}</p><p className="mt-1 text-slate-400">{text.stockNote}</p></div><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /></div></div></div></>}
                </>}
              </div>
              <div className="relative z-10 flex justify-center gap-2 border-t border-slate-100 py-4">{[0, 1, 2, 3].map((index) => <button key={index} type="button" onClick={() => { setActiveProduct(index) }} className={`h-2.5 rounded-full transition-all ${activeProduct === index ? 'w-8 bg-ocean' : 'w-2.5 bg-slate-300'}`} aria-label={`Go to product ${index + 1}`} />)}</div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-8 sm:px-8"><div className="rounded-3xl bg-blue-50 p-8"><h2 className="font-display text-3xl font-bold">YurLaps untuk Windows</h2><p className="mt-3 text-slate-600">Timing offline, race, dan sinkronisasi club dalam satu aplikasi.</p><a href="/download" className="mt-5 inline-block rounded-xl bg-ocean px-5 py-3 font-bold text-white">Download aplikasi</a></div></section>
        <section id="gallery" className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
          <div className="max-w-2xl"><p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-ocean">{text.gallery}</p><h2 className="font-display text-4xl font-extrabold tracking-[-0.07em] sm:text-6xl">{text.galleryTitle}</h2><p className="mt-5 text-lg leading-8 text-slate-500">{text.galleryText}</p></div>
          <div className="mt-12"><img src={gallery[0].src} alt={gallery[0].alt} className="h-auto max-h-[42rem] w-full rounded-[2rem] object-contain" /></div>
        </section>

        <section id="contact" className="mx-auto max-w-6xl px-5 pb-20 sm:px-8 lg:pb-28"><div className="rounded-[2rem] bg-ink px-7 py-14 text-white sm:px-12 lg:px-20"><p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-300">{text.contact}</p><h2 className="mt-4 max-w-2xl font-display text-4xl font-extrabold leading-[1] tracking-[-0.07em] sm:text-6xl">{text.contactTitle}</h2><p className="mt-5 max-w-lg text-base leading-7 text-slate-300">{text.contactText}</p><button onClick={openContact} className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3.5 text-sm font-bold text-ink transition hover:bg-blue-100">{text.contactButton} <Mail size={16} /></button></div></section>

        <section id="account" className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
          <div className="flex flex-col justify-between gap-5 border-t border-slate-200 pt-8 sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold">{text.account}</span>
              {session ? (
                <button onClick={openDashboard} className="inline-flex items-center gap-1.5 rounded-full bg-ocean px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#1855db]">
                  <LayoutDashboard size={14} /> {text.personalDashboard}
                </button>
              ) : (
                <button onClick={openLogin} className="inline-flex items-center gap-1.5 rounded-full bg-ocean px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#1855db]">
                  {text.login} <LogIn size={14} />
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {[['home', text.home], ['products', text.product], ['gallery', text.gallery], ['contact', text.contact]].map(([id, label]) => (
                <button key={id} onClick={() => scrollTo(id)} className="rounded-full bg-blue-50 px-3.5 py-2 text-xs font-bold text-ocean transition hover:bg-blue-100">{label}</button>
              ))}
            </div>
          </div>
        </section>
      </main>

      {contactOpen && <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/45 px-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={text.contact}>
        <div className="relative w-full max-w-sm rounded-[2rem] bg-white p-7 shadow-2xl">
          <button onClick={() => setContactOpen(false)} className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-ink" aria-label="Close contact dialog"><X size={19} /></button>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-ocean">{text.contact}</p>
          <h2 className="mt-3 font-display text-3xl font-extrabold tracking-[-0.06em] text-ink">{text.contactTitle}</h2>
          <a href="https://wa.me/6285156462372" target="_blank" rel="noreferrer" className="mt-7 flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#1ebe5d]">
            <MessageCircle size={18} /> WhatsApp
          </a>
        </div>
      </div>}

      {signupSuccessOpen && <div className="fixed inset-0 z-[95] grid place-items-center bg-slate-950/45 px-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="signup-success-title">
        <div className="w-full max-w-sm rounded-[2rem] bg-white p-8 text-center shadow-2xl animate-[fade-up_400ms_ease-out_both]">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-500">
            <Check size={32} strokeWidth={3} />
          </div>
          <h2 id="signup-success-title" className="mt-5 font-display text-3xl font-extrabold tracking-[-0.06em] text-ink">{text.signupSuccessTitle}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">{text.signupSuccessText}</p>
          <button type="button" onClick={() => { setSignupSuccessOpen(false); openDashboard() }} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-ocean px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#1855db]">
            {text.signupSuccessDashboard} <LayoutDashboard size={17} />
          </button>
          <button type="button" onClick={() => setSignupSuccessOpen(false)} className="mt-3 w-full text-center text-sm font-bold text-slate-500 transition hover:text-ocean">
            {text.signupSuccessClose}
          </button>
        </div>
      </div>}

      <footer className="mx-auto flex max-w-6xl items-center justify-between border-t border-slate-200 px-5 py-8 text-xs text-slate-400 sm:px-8"><span>© 2026 YurLaps. {text.footer}</span><button onClick={() => scrollTo('home')} className="flex items-center gap-2 font-semibold text-ink hover:text-ocean">{text.back} <ChevronDown size={14} className="rotate-180" /></button></footer>
      </>}
    </div>
  )
}

export default App
