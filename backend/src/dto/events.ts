export interface CreateRoomPayload {
  title: string;
  roomId?: string;
  turnDuration?: 180 | 300 | 600;
}

export interface JoinRoomPayload {
  roomId: string;
  username?: string;
}

export interface SendMessagePayload {
  roomId: string;
  text: string;
}

export interface DeleteMessagePayload {
  roomId: string;
  messageId: string;
}

export interface GetRoomStatePayload {
  roomId: string;
}
