import dbConnect from "../../../../lib/mongodb";
import { buildAssetReport } from "../../../../lib/assetReport";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()), 10);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ message: "Tahun tidak valid" }, { status: 400 });
    }

    await dbConnect();
    const report = await buildAssetReport(session.user.id, year);
    return NextResponse.json(report, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
  }
}
