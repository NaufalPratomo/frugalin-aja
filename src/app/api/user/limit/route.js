import dbConnect from "../../../../lib/mongodb";
import User from "../../../../lib/models/User";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
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

    return NextResponse.json({ 
      monthlyLimit: user.monthlyLimit || 0,
      budgetMode: user.budgetMode || 'ADAPTIVE'
    }, { status: 200 });
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

    const { monthlyLimit, budgetMode } = await req.json();

    await dbConnect();
    
    const updateData = { monthlyLimit: Number(monthlyLimit) };
    if (budgetMode && ['ADAPTIVE', 'STRICT'].includes(budgetMode)) {
      updateData.budgetMode = budgetMode;
    }

    // PERBAIKAN LOGIKA: Perbarui data user berdasarkan email sesi yang valid
    const user = await User.findOneAndUpdate(
      { email: session.user.email },
      updateData,
      { new: true }
    );

    if (!user) {
      return NextResponse.json({ message: "User tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ 
      monthlyLimit: user.monthlyLimit,
      budgetMode: user.budgetMode || 'ADAPTIVE'
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
  }
}