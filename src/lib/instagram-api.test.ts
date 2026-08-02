import assert from "node:assert/strict";
import test from "node:test";
import { isRetryableContainerFailure, parseContainerErrorCode } from "./instagram-api";

// 2026-08-02 저녁 릴스 실패의 실제 status 문자열.
const REAL_2207052 = "Error: Media upload has failed with error code 2207052";

test("parseContainerErrorCode: status 문자열에서 Meta 에러 코드를 뽑는다", () => {
  assert.equal(parseContainerErrorCode(REAL_2207052), 2207052);
  assert.equal(parseContainerErrorCode("Error: Media upload has failed with error code 2207026"), 2207026);
  assert.equal(parseContainerErrorCode("In Progress: Media is still being processed."), null);
});

test("일시 오류(2207052)는 재시도 대상 — 이걸 놓쳐서 릴스가 안 올라갔다", () => {
  assert.equal(isRetryableContainerFailure("ERROR", REAL_2207052), true);
});

test("규격 위반(포맷·용량·화면비)은 재시도해도 같은 결과라 즉시 실패", () => {
  for (const code of [2207004, 2207005, 2207006, 2207009, 2207010, 2207026]) {
    assert.equal(
      isRetryableContainerFailure("ERROR", `Error: Media upload has failed with error code ${code}`),
      false,
      `${code} 는 영구 실패여야 한다`,
    );
  }
});

test("다운로드/트랜스코딩 일시 오류는 재시도 대상", () => {
  for (const code of [2207001, 2207003, 2207008, 2207020, 2207032, 2207053]) {
    assert.equal(
      isRetryableContainerFailure("ERROR", `Error: Media upload has failed with error code ${code}`),
      true,
      `${code} 는 재시도 대상이어야 한다`,
    );
  }
});

test("EXPIRED 는 새 컨테이너로 다시 만들면 되므로 재시도 대상", () => {
  assert.equal(isRetryableContainerFailure("EXPIRED", "Expired"), true);
});

test("코드를 못 읽으면 한 번은 더 시도한다(원인 불명)", () => {
  assert.equal(isRetryableContainerFailure("ERROR", "Error: something went wrong"), true);
});
