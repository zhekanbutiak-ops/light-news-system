import NextAuth from "next-auth"
import GithubProvider from "next-auth/providers/github"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"

const handler = NextAuth({
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID as string,
      clientSecret: process.env.GITHUB_SECRET as string,
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
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
  ],
  pages: {
    signIn: "/auth/signin",
  },
})

export { handler as GET, handler as POST }
