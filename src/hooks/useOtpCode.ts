import { useState, useEffect, useRef } from "react";
import { generateTOTP, generateHOTP } from "@/lib/otp";
import type { AccountData } from "@/lib/types";

interface OtpResult {
  code: string;
  remaining: number;
  period: number;
}

export function useOtpCode(account: AccountData): OtpResult {
  const [code, setCode] = useState("------");
  const [remaining, setRemaining] = useState(account.period || 30);
  const lastStepRef = useRef(-1);

  useEffect(() => {
    if (account.type === "hotp") {
      generateHOTP(
        account.secret,
        account.counter,
        account.digits,
        account.algorithm,
      ).then(setCode);
      setRemaining(-1);
      return;
    }

    const period = account.period || 30;
    let active = true;

    const tick = async () => {
      if (!active) return;
      const nowMs = Date.now();
      const step = Math.floor(nowMs / 1000 / period);
      const rem = period - (nowMs / 1000) % period;
      setRemaining(rem);

      if (step !== lastStepRef.current) {
        lastStepRef.current = step;
        try {
          const result = await generateTOTP(
            account.secret,
            period,
            account.digits,
            account.algorithm,
          );
          if (active) setCode(result.code);
        } catch {
          if (active) setCode("ERROR");
        }
      }
    };

    tick();
    const interval = setInterval(tick, 100);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [
    account.secret,
    account.type,
    account.period,
    account.digits,
    account.algorithm,
    account.counter,
  ]);

  return { code, remaining, period: account.period || 30 };
}
