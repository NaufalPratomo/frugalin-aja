import dbConnect from "../../../../lib/mongodb";
import User from "../../../../lib/models/User";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ message: "Semua field harus diisi" }, { status: 400 });
    }

    await dbConnect();

    // Cek apakah email sudah terdaftar
    const userExists = await User.findOne({ email });
    if (userExists) {
      return NextResponse.json({ message: "Email sudah terdaftar" }, { status: 400 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Simpan user baru
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    return NextResponse.json({ message: "User berhasil didaftarkan" }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: "Terjadi kesalahan pada server", error: error.message }, { status: 500 });
  }
}