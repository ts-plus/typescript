export interface ExtendedModel extends Model {
  y: number
}

export function mkExtendedModel(): ExtendedModel {
  return { x: "test", y: 0 }
}