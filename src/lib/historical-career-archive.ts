// Server-only archive loading. Evidence and unconsumed source fields never enter
// client props, and serving a snapshot does not update its retrieval timestamp.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { normalizeHistoricalCareerData, type HistoricalCareerData } from "./historical-career-data";

const archives: Record<number, { sha256: string; sourceSha256: string; read: () => Promise<Buffer>; retrievalPrecision?: "approximate-minute" }> = {
  893: {
    sha256: "8006fe4fb1aec9e98c9d967f1b25188025ff083ff787e4f997472f68f6c28e23",
    sourceSha256: "314a8465cfef72fb2219e75f94befdce4feeffdffd2d9be8d2808a38df0f77e5",
    read: () => readFile(join(process.cwd(), "src/data/historical-career-archives/893-2026-10-04.json")),
  },
  977: {
    sha256: "5d851d07b14e2c3e8eb46152b00113e05b07f73afd9bad1f34946b4180979490",
    sourceSha256: "b4ea9cae22f25ce2f3fc470dd6b040abcd5dbbaeba05f5c4089e8fadebdb510d",
    read: () => readFile(join(process.cwd(), "src/data/historical-career-archives/977-2026-10-04.json")),
  },
  1495: {
    sha256: "d2c974405e6e3dc2b4ffbfb20d89885bacb1a227a273bd0a240d228f76a53ad6",
    sourceSha256: "6efabfcbb0014974f78e81ed416e34189f2ac50a08cc2f2086680b448e337627",
    read: () => readFile(join(process.cwd(), "src/data/historical-career-archives/1495-2026-10-04.json")),
  },
  76003: {
    sha256: "3be60da0aaf6a7784b0d6a8b8377df9bcca5be0f05a1bf31615e81a512b4c571",
    retrievalPrecision: "approximate-minute",
    sourceSha256: "9b1c3dc8657c757779381e832c8f61054a954dd5963aad9f4a1b02dd401b9d86",
    read: () => readFile(join(process.cwd(), "src/data/historical-career-archives/76003-2026-10-04.json")),
  },
  76375: {
    sha256: "5e9fab865536a6d3f8bb0a572ed5c83f978020b176321d9fd9f9685a91bde0b5",
    retrievalPrecision: "approximate-minute",
    sourceSha256: "5336a28280c7538cb5233cf142d2453f32719d5a7310ee43f4ce1e75c38c884a",
    read: () => readFile(join(process.cwd(), "src/data/historical-career-archives/76375-2026-10-04.json")),
  },
  406: {
    sha256: "9f6dfabb0c0ea4852880d6c6be586b29651c970864a511f84a339264fe193a25",
    sourceSha256: "de3132513d240e035656d8896036b835c4e26d15d0f3994bd03e0bfbd46c6812",
    read: () => readFile(join(process.cwd(), "src/data/historical-career-archives/406-2026-10-04.json")),
  },
  77142: {
    sha256: "c368f36994021e80c20b0ec1d25f3db00761488c4edff3ab73260069ef8c9158",
    sourceSha256: "bc8ccd41e6fc4739bcc018142ef2fc4184a0ca7b6979db7210a77ad6a13f5e2a",
    read: () => readFile(join(process.cwd(), "src/data/historical-career-archives/77142-2026-10-04.json")),
  },
  1449: {
    sha256: "45b4a77bc8b485d7b48ae28ecab57cb190191171715d480f1c78e2823a344710",
    sourceSha256: "4ee6f32e96330e8bbb72ac14535aec8ae23fc5158064df2dfc89e4bc57313bf9",
    read: () => readFile(join(process.cwd(), "src/data/historical-career-archives/1449-2026-10-04.json")),
  },
};

export function validateHistoricalCareerArchive(raw: unknown, playerId: number, sha256: string): HistoricalCareerData | null {
  try {
    const encoded = JSON.stringify(raw);
    if (typeof encoded !== "string" || createHash("sha256").update(encoded).digest("hex") !== sha256) return null;
    return normalizeHistoricalCareerData(raw, playerId);
  } catch { return null; }
}
/** Verify the original audited bytes before parsing. JSON bundlers can round
 * long floating-point audit observations, making object hashes compiler-dependent. */
export function validateHistoricalCareerArchiveSource(source: Uint8Array, playerId: number, sourceSha256: string, canonicalSha256: string): HistoricalCareerData | null {
  try {
    if (createHash("sha256").update(source).digest("hex") !== sourceSha256) return null;
    return validateHistoricalCareerArchive(JSON.parse(Buffer.from(source).toString("utf8")), playerId, canonicalSha256);
  } catch { return null; }
}
export async function getHistoricalCareerArchive(playerId: number): Promise<HistoricalCareerData | null> {
  if (!Object.hasOwn(archives, playerId)) return null;
  const archive = archives[playerId];
  try {
    const data = validateHistoricalCareerArchiveSource(await archive.read(), playerId, archive.sourceSha256, archive.sha256);
    return data && archive.retrievalPrecision ? { ...data, retrievalPrecision: archive.retrievalPrecision } : data;
  }
  catch { return null; }
}
