import { describe, expect, it } from "vitest";

import { caretAfterMask, countSignificant, maskDocument, maskPhone } from "@/lib/masks";
import { optionalPhone } from "@/lib/validation";

// Máscaras de telefone e CPF/CNPJ (NBB-84) e a regra do telefone no servidor (M7-A).

describe("maskPhone (M2-B)", () => {
  it("formata enquanto digita", () => {
    expect(maskPhone("")).toBe("");
    expect(maskPhone("1")).toBe("(1");
    expect(maskPhone("11")).toBe("(11");
    expect(maskPhone("119")).toBe("(11) 9");
    expect(maskPhone("1132345")).toBe("(11) 3234-5");
  });

  it("fixo com 10 dígitos e celular com 11", () => {
    expect(maskPhone("1132345678")).toBe("(11) 3234-5678");
    expect(maskPhone("11912345678")).toBe("(11) 91234-5678");
  });

  it("descarta o que não é dígito e corta em 11", () => {
    expect(maskPhone("(11) 9abc1234-5678")).toBe("(11) 91234-5678");
    expect(maskPhone("119123456789999")).toBe("(11) 91234-5678");
    expect(maskPhone("+55")).toBe("(55");
  });
});

describe("maskDocument (M3-A)", () => {
  it("CPF até 11 números", () => {
    expect(maskDocument("529")).toBe("529");
    expect(maskDocument("5299")).toBe("529.9");
    expect(maskDocument("52998224725")).toBe("529.982.247-25");
  });

  it("CNPJ a partir do 12º caractere", () => {
    expect(maskDocument("112223330001")).toBe("11.222.333/0001");
    expect(maskDocument("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("CNPJ alfanumérico: letras em maiúsculas trocam para a máscara de CNPJ", () => {
    expect(maskDocument("12abc")).toBe("12.ABC");
    expect(maskDocument("12abc34501de35")).toBe("12.ABC.345/01DE-35");
  });

  it("descarta pontuação e corta em 14", () => {
    expect(maskDocument("529.982.247-25")).toBe("529.982.247-25");
    expect(maskDocument("11222333000181999")).toBe("11.222.333/0001-81");
  });
});

describe("posição do cursor (M4-A)", () => {
  it("conta só letras e números antes do cursor", () => {
    expect(countSignificant("(11) 9123", 6)).toBe(3);
    expect(countSignificant("12.AB", 5)).toBe(4);
  });

  it("volta para depois do mesmo número de caracteres no texto formatado", () => {
    // Corrigindo o 3º dígito de "(11) 91234-5678": o cursor fica logo depois dele.
    expect(caretAfterMask("(11) 91234-5678", 3)).toBe(6);
    expect(caretAfterMask("529.982.247-25", 4)).toBe(5);
    expect(caretAfterMask("529.982", 0)).toBe(0);
    expect(caretAfterMask("529", 10)).toBe(3);
  });
});

describe("telefone no servidor (M7-A)", () => {
  const phone = optionalPhone(20);

  it("aceita DDD + número e guarda no formato da máscara", () => {
    expect(phone.parse("11912345678")).toBe("(11) 91234-5678");
    expect(phone.parse("(11) 3234-5678")).toBe("(11) 3234-5678");
    expect(phone.parse("")).toBeNull();
  });

  it("recusa sem DDD, estrangeiro ou com letras", () => {
    for (const value of ["91234-5678", "+351 912 345 678", "(11) 9123A-5678", "119123456789"]) {
      expect(phone.safeParse(value).error?.issues[0]?.message).toBe(
        "Informe o telefone com DDD, ex.: (11) 91234-5678",
      );
    }
  });
});
