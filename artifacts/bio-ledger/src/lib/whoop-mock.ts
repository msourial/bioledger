import { useState, useEffect } from 'react';

export interface BioData {
  hrv: number;
  strain: number;
}

/**
 * Mocks the Whoop API v2 bio-sensor readouts.
 * HRV typically ranges from 30 to 150ms depending on the person.
 * Strain is a daily accumulation from 0 to 21.
 * For this hackathon, we create a fluctuating value every 5 seconds.
 */
export function useMockBioData(): BioData {
  const [bioData, setBioData] = useState<BioData>({
    hrv: 65,
    strain: 12.4
  });

  useEffect(() => {
    // Fluctuate stats slightly every 5 seconds to simulate live readouts
    const interval = setInterval(() => {
      setBioData(prev => {
        // HRV goes up and down by small margins
        const hrvDelta = (Math.random() * 6) - 3;
        let newHrv = prev.hrv + hrvDelta;
        if (newHrv < 30) newHrv = 30;
        if (newHrv > 120) newHrv = 120;

        // Strain only goes up slowly during a session
        const strainDelta = Math.random() * 0.05;
        let newStrain = prev.strain + strainDelta;
        if (newStrain > 21) newStrain = 21;

        return {
          hrv: Math.round(newHrv),
          strain: Number(newStrain.toFixed(1))
        };
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return bioData;
}
