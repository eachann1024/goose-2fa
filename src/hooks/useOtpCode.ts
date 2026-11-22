import { useEffect, useMemo, useState } from "react";
import { generateHOTP, generateTOTP } from "@/lib/otp";
import type { AccountData } from "@/lib/types";
import { useOtpStep } from "./otp-clock";

export function useOtpCode({ type, secret, counter, period, digits, algorithm }: AccountData): string {
  const [result, setResult] = useState<{ request: object; code: string } | null>(null);
  const timeBased = type === "totp";
  const interval = period || 30;
  const step = useOtpStep(interval, timeBased, counter);
  const request = useMemo(
    () => ({ secret, digits, algorithm, step, interval, timeBased }),
    [secret, digits, algorithm, step, interval, timeBased],
  );

  useEffect(() => {
    let active = true;
    const { secret, digits, algorithm, step, interval, timeBased } = request;
    const generate = async () => {
      try {
        const code = timeBased
          ? (await generateTOTP(secret, interval, digits, algorithm, step * interval)).code
          : await generateHOTP(secret, step, digits, algorithm);
        if (active) setResult({ request, code });
      } catch {
        if (active) setResult({ request, code: "ERROR" });
      }
    };
    void generate();
    return () => { active = false; };
  }, [request]);

  return result?.request === request ? result.code : "------";
}
