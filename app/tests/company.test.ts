import { withEnv, freshImport } from "./helpers.ts";
import { test } from "node:test";
import assert from "node:assert/strict";

type Mod = typeof import("../src/lib/company.ts");
const COMPANY_ENV = {
  COMPANY_LEGAL_NAME: undefined,
  COMPANY_ADDRESS: undefined,
  COMPANY_EMAIL: undefined,
  COMPANY_PRIVACY_EMAIL: undefined,
  COMPANY_PHONE: undefined,
  LEGAL_UPDATED_AT: undefined,
} as Record<string, string | undefined>;

test("company: unset legal details render a visible placeholder, never blank", async () => {
  await withEnv(COMPANY_ENV, async () => {
    const m = await freshImport<Mod>("../src/lib/company.ts");
    assert.match(m.COMPANY.legalName, /^\[BELUM DIISI/);
    assert.match(m.COMPANY.address, /^\[BELUM DIISI/);
    assert.match(m.COMPANY.email, /^\[BELUM DIISI/);
    assert.match(m.COMPANY.phone, /^\[BELUM DIISI/);
  });
});

test("company: incompleteness is detected so an unfilled policy can't quietly ship", async () => {
  await withEnv(COMPANY_ENV, async () => {
    const m = await freshImport<Mod>("../src/lib/company.ts");
    assert.equal(m.companyDetailsIncomplete(), true);
  });
});

test("company: env values are used verbatim when set", async () => {
  await withEnv(
    {
      ...COMPANY_ENV,
      COMPANY_LEGAL_NAME: "PT Contoh Farma",
      COMPANY_ADDRESS: "Jl. Contoh No. 1, Jakarta",
      COMPANY_EMAIL: "halo@contoh.id",
      COMPANY_PHONE: "+62 21 000 000",
      LEGAL_UPDATED_AT: "2026-09-01",
    },
    async () => {
      const m = await freshImport<Mod>("../src/lib/company.ts");
      assert.equal(m.COMPANY.legalName, "PT Contoh Farma");
      assert.equal(m.COMPANY.address, "Jl. Contoh No. 1, Jakarta");
      assert.equal(m.COMPANY.legalUpdatedAt, "2026-09-01");
      assert.equal(m.companyDetailsIncomplete(), false, "all fields filled");
    },
  );
});

test("company: privacy email falls back to the general contact", async () => {
  await withEnv({ ...COMPANY_ENV, COMPANY_EMAIL: "halo@contoh.id" }, async () => {
    const m = await freshImport<Mod>("../src/lib/company.ts");
    assert.equal(m.COMPANY.privacyEmail, "halo@contoh.id");
  });
  await withEnv(
    { ...COMPANY_ENV, COMPANY_EMAIL: "halo@contoh.id", COMPANY_PRIVACY_EMAIL: "dpo@contoh.id" },
    async () => {
      const m = await freshImport<Mod>("../src/lib/company.ts");
      assert.equal(m.COMPANY.privacyEmail, "dpo@contoh.id", "an explicit DPO address wins");
    },
  );
});

test("company: one missing field is enough to report incomplete", async () => {
  await withEnv(
    {
      ...COMPANY_ENV,
      COMPANY_LEGAL_NAME: "PT Contoh Farma",
      COMPANY_ADDRESS: "Jl. Contoh No. 1",
      COMPANY_EMAIL: "halo@contoh.id",
      // phone deliberately left unset
    },
    async () => {
      const m = await freshImport<Mod>("../src/lib/company.ts");
      assert.equal(m.companyDetailsIncomplete(), true);
    },
  );
});

test("company: the product name is fixed, not env-driven", async () => {
  await withEnv(COMPANY_ENV, async () => {
    const m = await freshImport<Mod>("../src/lib/company.ts");
    assert.equal(m.COMPANY.productName, "MLR Flow");
  });
});

test("company: legalUpdatedAt has a sane default date shape", async () => {
  await withEnv(COMPANY_ENV, async () => {
    const m = await freshImport<Mod>("../src/lib/company.ts");
    assert.match(m.COMPANY.legalUpdatedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(!Number.isNaN(Date.parse(m.COMPANY.legalUpdatedAt)));
  });
});
