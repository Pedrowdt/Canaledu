import { describe, it, expect } from "vitest";
import GradeEditorCore from "../../src/core/gradeEditorCore.js";

describe("GradeEditorCore", () => {
  it("gera 48 slots base de 30 minutos a partir das 06:00:00", () => {
    const slots = GradeEditorCore.generateBaseSlots(6, 30);
    expect(slots).toHaveLength(48);
    expect(slots[0].time).toBe("06:00:00");
    expect(slots[0].duration).toBe("00:30:00");
    expect(slots[0].endTime).toBe("06:30:00");
    expect(slots[1].time).toBe("06:30:00");
    expect(slots[47].time).toBe("05:30:00");
    expect(slots[47].endTime).toBe("06:00:00");
  });

  it("converte tempo e segundos com suporte a wrap de 24h", () => {
    expect(GradeEditorCore.timeToSec("00:30:00")).toBe(1800);
    expect(GradeEditorCore.secToTime(1800)).toBe("00:30:00");
    expect(GradeEditorCore.addSeconds("06:00:00", 1800)).toBe("06:30:00");
    expect(GradeEditorCore.addSeconds("23:45:00", 1800)).toBe("00:15:00");
  });

  it("atribui programa a um slot e opcionalmente adota a duração do programa", () => {
    const slots = GradeEditorCore.generateBaseSlots(6, 30);
    const updated = GradeEditorCore.assignProgramToSlot(slots, 0, {
      title: "JORNAL DA MANHÃ",
      code: "JM-01",
      tempo: "00:45:00",
    }, { adoptDuration: true, cascade: true });

    expect(updated[0].program.title).toBe("JORNAL DA MANHÃ");
    expect(updated[0].duration).toBe("00:45:00");
    expect(updated[0].endTime).toBe("06:45:00");
    // Cascata deve ter empurrado o slot 1 para 06:45:00
    expect(updated[1].time).toBe("06:45:00");
  });

  it("ajusta duração de um bloco com modo cascata ativo", () => {
    const slots = GradeEditorCore.generateBaseSlots(6, 30);
    // Aumenta o primeiro bloco de 30m para 60m (3600s)
    const adjusted = GradeEditorCore.adjustBlockDuration(slots, 0, 3600, { cascade: true });
    expect(adjusted[0].duration).toBe("01:00:00");
    expect(adjusted[0].endTime).toBe("07:00:00");
    expect(adjusted[1].time).toBe("07:00:00");
    expect(adjusted[1].endTime).toBe("07:30:00");
    expect(adjusted[2].time).toBe("07:30:00");
  });

  it("ajusta duração sem cascata e detecta sobreposições ou buracos", () => {
    const slots = GradeEditorCore.generateBaseSlots(6, 30);
    // Altera slot 0 para 45 minutos sem cascata -> gera sobreposição com o slot 1 (que ainda começa às 06:30)
    const adjusted = GradeEditorCore.adjustBlockDuration(slots, 0, 2700, { cascade: false });
    expect(adjusted[0].endTime).toBe("06:45:00");
    expect(adjusted[1].time).toBe("06:30:00");

    const issues = GradeEditorCore.detectGapsAndOverlaps(adjusted);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].type).toBe("overlap");
    expect(issues[0].diffSec).toBe(900); // 15 min de sobreposição
  });

  it("converte blocos para gradeByDay e gradeOrderByDay com sufixos [2ª]", () => {
    const slots = GradeEditorCore.generateBaseSlots(6, 30);
    let cur = GradeEditorCore.assignProgramToSlot(slots, 0, { title: "DESENHO ANIMADO" }, { adoptDuration: false });
    cur = GradeEditorCore.assignProgramToSlot(cur, 2, { title: "DESENHO ANIMADO" }, { adoptDuration: false });

    const { grade, order } = GradeEditorCore.blocksToGrade(cur);
    expect(order).toEqual(["DESENHO ANIMADO", "DESENHO ANIMADO [2ª]"]);
    expect(grade["DESENHO ANIMADO"]).toBe("06:00:00");
    expect(grade["DESENHO ANIMADO [2ª]"]).toBe("07:00:00");
  });

  it("reconverte grade salva para blocos utilizáveis", () => {
    const gradeObj = {
      "TELEJORNAL": "07:00:00",
      "DOCUMENTÁRIO": "08:00:00",
    };
    const orderList = ["TELEJORNAL", "DOCUMENTÁRIO"];
    const blocks = GradeEditorCore.gradeToBlocks(gradeObj, orderList);
    expect(blocks.length).toBe(2);
    expect(blocks[0].program.title).toBe("TELEJORNAL");
    expect(blocks[0].time).toBe("07:00:00");
    expect(blocks[0].duration).toBe("01:00:00"); // 08:00 - 07:00
    expect(blocks[1].program.title).toBe("DOCUMENTÁRIO");
  });
});
