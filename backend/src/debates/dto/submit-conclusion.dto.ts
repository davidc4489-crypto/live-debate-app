export class SubmitConclusionDto {
  content!: string;
  /** Si true, l'utilisateur a confirmé après un avertissement modération. */
  confirmWarn?: boolean;
}
