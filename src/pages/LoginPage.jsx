// ─────────────────────────────────────────────────────────────────────────────
// LoginPage.jsx — the only door into the Control Plane.
//
// Layout, grid background and card are unchanged; what moved is the palette
// (red → HR Clouds purple), the mark, and the words. This is not the product's
// sign-in: a platform operator holds keys to every customer organisation at
// once, so the screen says what is behind it rather than pretending to be an
// ordinary login.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import logo from '../assets/brand/logo.png'
import { BRAND } from '../config/brand'
import api from '../api'

/** The email this device last signed in with, or ''. Read once, at mount. */
function rememberedEmail() {
  try {
    return localStorage.getItem('rememberedEmail') || ''
  } catch {
    // Private browsing and blocked site data both throw here. An empty box is
    // the right outcome; a crashed sign-in screen is not.
    return ''
  }
}

/** A stand-in session id, for when no gateway is configured yet. */
function localSessionToken() {
  return `local-session-${Date.now()}`
}

export default function LoginPage() {
  const navigate = useNavigate()
  // Seeded from storage at mount rather than in an effect, so the box is never
  // briefly empty and the screen never renders twice to fill itself in.
  const [form, setForm] = useState(() => ({ email: rememberedEmail(), password: '' }))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(() => !!rememberedEmail())

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    if (error) setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      let accessToken = null
      let refreshToken = null
      let user = null

      // If a gateway is configured, use the live auth endpoint
      if (api.baseUrl) {
        const response = await api.post('/api/auth/login', {
          email: form.email.trim(),
          password: form.password,
        })
        const resData = response?.data ?? response ?? {}
        accessToken = resData.accessToken
        refreshToken = resData.refreshToken
        user = resData.user || {
          name: 'Platform Operator',
          email: form.email.trim(),
          role: 'super-admin',
        }
      } else {
        // No gateway yet — sign in locally so the console can be walked and
        // reviewed before the platform API exists. This branch disappears the
        // moment VITE_API_BASE_URL is set.
        accessToken = localSessionToken()
        user = {
          name: form.email.split('@')[0] || 'Platform Operator',
          email: form.email.trim(),
          role: 'super-admin',
        }
      }

      api.loginUser(accessToken, refreshToken, user)

      if (rememberMe) {
        localStorage.setItem('rememberedEmail', form.email.trim())
      } else {
        localStorage.removeItem('rememberedEmail')
      }

      navigate('/dashboard')
    } catch (err) {
      setError(
        err.message ||
          'We could not sign you in. Check the email and password and try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative px-4 py-8 font-sans antialiased"
      style={{
        backgroundColor: '#f7f5fc',
        backgroundImage:
          'linear-gradient(to right, #e6e1f0 1px, transparent 1px), linear-gradient(to bottom, #e6e1f0 1px, transparent 1px)',
        backgroundSize: '36px 36px',
      }}
    >
      {/* Login Card */}
      <div className="w-full max-w-[460px] bg-white rounded-2xl border border-[#e6e1f0] p-8 lg:p-10 shadow-[0_8px_30px_rgba(21,12,36,0.04)] z-10">
        <div className="mb-8 flex justify-between items-center gap-3">
          <img src={logo} alt={BRAND.product} className="h-9 w-auto object-contain" />
          <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#9333ea] bg-[#9333ea]/10 px-2.5 py-1 rounded flex items-center gap-1 shrink-0">
            <ShieldCheck size={12} />
            {BRAND.console}
          </span>
        </div>

        <div className="mb-8">
          <h2 className="text-3xl lg:text-4xl font-black text-[#150c24] tracking-tight mb-2">
            Welcome back
          </h2>
          <p className="text-[#22143a]/60 text-sm font-semibold">
            {BRAND.purpose} Access is limited to platform staff.
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div
            role="alert"
            className="mb-6 p-4 rounded-xl bg-[#f7f5fc] text-[#7e22ce] border border-[#e6e1f0] text-xs font-bold leading-relaxed flex items-start gap-2"
          >
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="login-email"
              className="block text-[10px] font-black text-[#22143a] uppercase tracking-widest mb-2"
            >
              Email Address
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={handleChange}
              placeholder="you@hrclouds.in"
              className="w-full px-4 py-3.5 rounded-xl border-2 border-[#e6e1f0] bg-white text-[#22143a] placeholder-[#a79db4] text-sm font-semibold focus:outline-none focus:border-[#9333ea] focus:ring-4 focus:ring-[#9333ea]/10 transition-all"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label
                htmlFor="login-password"
                className="block text-[10px] font-black text-[#22143a] uppercase tracking-widest"
              >
                Password
              </label>
            </div>
            <div className="relative">
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full pl-4 pr-12 py-3.5 rounded-xl border-2 border-[#e6e1f0] bg-white text-[#22143a] placeholder-[#a79db4] text-sm font-semibold focus:outline-none focus:border-[#9333ea] focus:ring-4 focus:ring-[#9333ea]/10 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#22143a]/40 hover:text-[#9333ea] transition-colors p-1 flex items-center justify-center cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded text-[#9333ea] border-2 border-[#e6e1f0] focus:ring-[#9333ea]/10 cursor-pointer accent-[#9333ea]"
              />
              <span className="text-xs text-[#22143a]/75 font-semibold">Remember me</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#9333ea] hover:bg-[#7e22ce] active:bg-[#3b0764] text-white font-black py-4 px-6 rounded-xl text-sm transition-all cursor-pointer shadow-lg shadow-[#9333ea]/10 hover:shadow-xl hover:shadow-[#9333ea]/20 active:scale-[0.99] disabled:opacity-70 disabled:pointer-events-none uppercase tracking-widest text-center"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-7 text-xs text-[#a79db4] font-semibold leading-relaxed">
          Platform accounts are issued by {BRAND.product}, not self-registered. If you
          cannot get in, contact{' '}
          <a
            href={`mailto:${BRAND.supportEmail}`}
            className="text-[#7e22ce] font-bold underline underline-offset-2"
          >
            {BRAND.supportEmail}
          </a>
          .
        </p>
      </div>

      {/* Footer copyright */}
      <p className="mt-8 text-center text-xs text-[#a79db4] font-medium">
        © {new Date().getFullYear()} {BRAND.product} · {BRAND.tagline}
      </p>
    </div>
  )
}
