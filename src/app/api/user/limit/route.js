import dbConnect from "../../../../lib/mongodb";
import User from "../../../../lib/models/User";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { NextResponse } from "next/server";

// 1. Mengambil data limit anggaran bulanan
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    
    // PERBAIKAN LOGIKA: Cari user berdasarkan email sesi yang valid
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ message: "User tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ monthlyLimit: user.monthlyLimit || 0 }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
  }
}

// 2. Memperbarui data limit anggaran bulanan
export async function PUT(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { monthlyLimit } = await req.json();

    await dbConnect();
    
    // PERBAIKAN LOGIKA: Perbarui data user berdasarkan email sesi yang valid
    const user = await User.findOneAndUpdate(
      { email: session.user.email },
      { monthlyLimit: Number(monthlyLimit) },
      { new: true }
    );

    if (!user) {
      return NextResponse.json({ message: "User tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ monthlyLimit: user.monthlyLimit }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
  }
}