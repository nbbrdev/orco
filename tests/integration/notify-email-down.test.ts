import { afterEach, describe, expect, it, vi } from "vitest";

import type * as email from "@/lib/email";
import { notifyFreelancer } from "@/lib/notify";

// O aviso ao freelancer com o e-mail fora do ar (RN-42, NBB-55 E5): não lança erro, e o log não leva
// o e-mail da conta. O envio é simulado só neste arquivo.

const failure = Object.assign(new Error("Falha ao falar com maria@example.com"), {
  code: "ECONNECTION",
});

vi.mock("@/lib/email", async (importOriginal) => ({
  ...(await importOriginal<typeof email>()),
  sendEmail: vi.fn().mockImplementation(() => Promise.reject(failure)),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("notifyFreelancer com o e-mail fora do ar", () => {
  it("não lança erro e loga só o orçamento e o código do erro", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      notifyFreelancer(
        { accountEmail: "maria@example.com", emailNotifications: true },
        {
          type: "quote_response",
          quoteId: "7d3f6a4e-1f2b-4c5d-8e9f-0a1b2c3d4e5f",
          number: 12,
          decision: "approved",
          respondentName: null,
          clientName: null,
          reasonCode: null,
          reason: null,
        },
      ),
    ).resolves.toBeUndefined();

    expect(log).toHaveBeenCalledWith("Falha ao enviar o aviso ao freelancer.", {
      quoteId: "7d3f6a4e-1f2b-4c5d-8e9f-0a1b2c3d4e5f",
      code: "ECONNECTION",
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("maria@example.com");
  });
});
