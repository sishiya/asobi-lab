// tools/calibrate.mjs が書く。手で直さない（その絵自身の顔を、同じしくみで読んだ数）
export const CALIBRATED = {
  monalisa: {goal: {jaw: 0.007,smile: 0,frown: 0.099,round: 0.02},roll: -0.9,yaw: -0.438},
  pearl: {goal: {jaw: 0.01,smile: 0,frown: 0.005,round: 0.079},roll: 10.4,yaw: -1.018},
  lizard: {goal: {jaw: 0.047,smile: 0,frown: 0.001,round: 0.57},roll: 15.7,yaw: 0.068},
  ducreux: {goal: {jaw: 0.007,smile: 0.583,frown: 0.101,round: 0.003},roll: -12.9,yaw: -0.746},
  courbet: {goal: {jaw: 0.039,smile: 0,frown: 0.017,round: 0.097},roll: 0.5,yaw: -0.037},
  hals: {goal: {jaw: 0.002,smile: 0.643,frown: 0.019,round: 0.041},roll: 2.4,yaw: -0.313},
  rembrandt: {goal: {jaw: 0.093,smile: 0,frown: 0.002,round: 0.462},roll: -9.4,yaw: 0.155},
};
