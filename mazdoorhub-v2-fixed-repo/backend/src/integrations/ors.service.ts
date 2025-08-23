import { Injectable } from '@nestjs/common';
@Injectable()
export class OrsService {
  async eta(fromLat: number, fromLon: number, toLat: number, toLon: number) {
    const R = 6371;
    const toRad = (d: number) => d * Math.PI / 180;
    const dLat = toRad(toLat - fromLat);
    const dLon = toRad(toLon - fromLon);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distKm = R * c;
    const etaMin = Math.max(3, Math.round(distKm / 30 * 60));
    return etaMin;
  }
}
