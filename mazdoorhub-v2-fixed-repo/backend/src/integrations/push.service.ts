import { Injectable } from "@nestjs/common";
@Injectable()
export class PushService {
  async notifyUser(userId: string, payload: any) {
    console.log("Push to", userId, payload?.title || payload);
  }
}
