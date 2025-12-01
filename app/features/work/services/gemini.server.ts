import { GoogleGenerativeAI } from "@google/generative-ai";
import { promises as fs } from "fs";

export type GeminiStep = {
  type: "click" | "input" | "navigate" | "wait" | "decision";
  action: string;
  description: string;
  confidence: number;
};

function makeClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenerativeAI(apiKey);
}

export async function analyzeFramesWithGemini(
  framePaths: string[],
  options?: { model?: string; promptExtras?: string },
): Promise<GeminiStep[]> {
  const genAI = makeClient();

  // 여러 모델을 fallback으로 시도
  const models = [
    options?.model ?? "gemini-2.0-flash",
    "gemini-flash-latest",
    "gemini-2.5-flash",
  ];

  // 이미지 파트 구성
  const imageParts = await Promise.all(
    framePaths.map(async (p) => ({
      inlineData: {
        mimeType: "image/jpeg",
        data: (await fs.readFile(p)).toString("base64"),
      },
    })),
  );

  const prompt = `당신은 업무 프로세스 분석 전문가입니다.
다음 이미지들은 시간 순서대로 캡처된 화면입니다.
이 이미지들을 분석하여 다음 3단계 과정을 통해 업무 프로세스를 추출하세요.

【1단계: 영상 스캔】
1) 화면 전환점 식별
2) 각 단계 주요 액션 (동사 중심)
3) 사용 도구/시스템/프로그램 식별
4) 의사결정 지점 (Yes/No) 식별
5) 최종 산출물 파악

【2단계: 심화 분석】
6) 오류 발생 가능 지점 및 예방책 도출
7) 필수/선택 단계 구분

【3단계: JSON 생성】
분석된 내용을 바탕으로 다음 JSON 스키마에 맞춰 출력하세요.
(주의: 기존 시스템 호환성을 위해 tools, errors 등의 정보는 description 필드에 포함시켜야 합니다)

{
  "steps": [
    {
      "type": "click|input|navigate|wait|decision",
      "action": "단계명 (예: 로그인 버튼 클릭)",
      "description": "상세 설명.\\n\\n[분석 정보]\\n- 도구: [사용된 도구]\\n- 세부 액션: [액션 목록]\\n- 주의사항/에러: [오류 및 예방책]",
      "confidence": 0-100
    }
  ]
}

JSON 외의 다른 텍스트는 출력하지 마세요.`;

  // 모델을 순서대로 시도
  let lastError: Error | null = null;
  for (const modelName of models) {
    try {
      console.log(`[Gemini] Trying model: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });

      const result = await model.generateContent([...imageParts, prompt]);

      // 응답 본문에서 JSON만 추출
      const text = result.response.text();
      const json = extractJson(text);
      if (!json?.steps || !Array.isArray(json.steps)) {
        throw new Error("Invalid JSON format from Gemini");
      }

      console.log(`[Gemini] Successfully used model: ${modelName}`);
      return json.steps as GeminiStep[];
    } catch (error: any) {
      console.warn(`[Gemini] Model ${modelName} failed:`, error.message);
      lastError = error;

      // 503 에러가 아니면 더 이상 시도하지 않음
      if (error.status && error.status !== 503) {
        throw error;
      }

      // 다음 모델 시도 전 짧은 대기
      if (models.indexOf(modelName) < models.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  // 모든 모델 실패
  throw lastError || new Error("All Gemini models failed");
}

function extractJson(text: string) {
  try {
    // ```json ... ``` 코드블록 포맷 처리
    const codeBlock = text.match(/```json[\s\S]*?```/i);
    if (codeBlock) {
      const inner = codeBlock[0].replace(/```json/i, "").replace(/```/g, "");
      return JSON.parse(inner);
    }
    // 일반 텍스트에 JSON만 있을 경우
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      const slice = text.slice(firstBrace, lastBrace + 1);
      return JSON.parse(slice);
    }
    return JSON.parse(text);
  } catch (e) {
    throw new Error("Failed to parse JSON from Gemini response");
  }
}
