export interface CreateRoomPayload {
  title: string;
  turnDuration?: 180 | 300 | 600;
  accessToken?: string;
}

export interface JoinRoomPayload {
  roomId: string;
  username?: string;
  accessToken?: string;
}

export interface EndDebatePayload {
  roomId: string;
  accessToken: string;
}

export interface SendMessagePayload {
  roomId: string;
  text: string;
  /** Token émis après un avertissement modération (envoi malgré le warn). */
  warnToken?: string;
}

export interface GetRoomStatePayload {
  roomId: string;
}

export interface ValidateDebateStartPayload {
  roomId: string;
  accessToken: string;
}

export interface SubscribeUserPayload {
  accessToken: string;
}
