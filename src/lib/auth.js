import CredentialsProvider from "next-auth/providers/credentials";
import dbConnect from "./mongodb";
import User from "./models/User";
import bcrypt from "bcryptjs";

/** @type {import("next-auth").AuthOptions} */
export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {},

      async authorize(credentials) {
        const { email, password } = credentials;

        try {
          await dbConnect();
          
          // 1. Cari user berdasarkan email
          const user = await User.findOne({ email });
          if (!user) {
            throw new Error("Email atau password salah");
          }

          // 2. Cocokkan password yang diinput dengan hash di database
          const passwordMatch = await bcrypt.compare(password, user.password);
          if (!passwordMatch) {
            throw new Error("Email atau password salah");
          }

          // 3. Jika sukses, kembalikan data user (tanpa password)
          return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
          };
        } catch (error) {
          throw new Error(error.message);
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    // Menyisipkan ID user ke dalam JSON Web Token (JWT)
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    // Mengekspos ID user ke sisi Client Session (UI)
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login", // Mengarahkan user yang belum login ke halaman /login
  },
};
