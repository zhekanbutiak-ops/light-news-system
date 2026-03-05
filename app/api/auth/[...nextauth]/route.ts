import NextAuth from "next-auth"
import GithubProvider from "next-auth/providers/github"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"

const providers = [
  CredentialsProvider({
    name: "Пошта та пароль",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Пароль", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null
      const email = process.env.CREDENTIALS_EMAIL
      const password = process.env.CREDENTIALS_PASSWORD
      if (!email || !password) return null
      if (credentials.email === email && credentials.password === password) {
        return { id: "1", name: credentials.email.split("@")[0], email: credentials.email }
      }
      return null
    },
  }),
]

if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
  providers.push(
    GithubProvider({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }) as never
  )
}
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }) as never
  )
}

const handler = NextAuth({
  providers,
  pages: {
    signIn: "/auth/signin",
  },
})

export { handler as GET, handler as POST }
