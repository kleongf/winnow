// PROTOTYPE (throwaway): real droid_100 rows from the research/droid-100 notes (outcome, length,
// max gripper, instruction). Uninstructed failures carry the video note a labeller would start from.
export interface RawEpisode {
  index: number;
  outcome: "success" | "failure";
  duration: number;
  maxGripper: number;
  instruction: string | null;
  note: string | null;
}

type Row = [number, RawEpisode["outcome"], number, number, string | null, string | null];

// prettier-ignore
const rows: Row[] = [
  [0, "success", 11.1, 0.81, "Put the marker in the pot", null],
  [1, "success", 15.9, 0.72, "Put the candy bar on the left side of the first shelf", null],
  [2, "success", 9.5, 0.75, "Put one green sachet in the grey bowl.", null],
  [3, "success", 13.7, 0.99, "Place the pack of doritos inside the sink", null],
  [5, "failure", 5.8, 0.49, null, "green block and black bowl on table; arm reaches the block; clip ends at 5.8 s"],
  [6, "success", 12.1, 0.81, "Take the pen out of the bowl and place it on the table", null],
  [7, "success", 39.7, 0.59, "Pick up the orange block on the right and put it on top of the orange block", null],
  [8, "success", 7.6, 0.81, "Put the metal object with the orange handle in the blue cup", null],
  [11, "success", 26.9, 0.12, "Move the glass to the second row in the dishwasher", null],
  [12, "success", 14.3, 0.5, "Pick up the lid from the table and put it on the pot", null],
  [13, "success", 13.1, 0.99, "Pick up the black object from the striped towel and place it on the white sheet of paper on the right", null],
  [16, "success", 11.5, 0.67, "Pick up the blue block and put it in the white mug on the right", null],
  [17, "success", 17.6, 0.99, "Put the cloth on the table", null],
  [21, "success", 6.1, 0.59, "Put the orange rubber duck into the pot", null],
  [24, "success", 71.1, 0.94, "Put the tissues in the rubbish bin.", null],
  [25, "success", 37.2, 0.99, "Put the middle fork in the middle section of the white object", null],
  [26, "success", 7.9, 0.87, "Put the cable in the storage box", null],
  [27, "success", 24.4, 0.85, "Put the bread in the toaster", null],
  [28, "success", 26.5, 0.95, "Put the white book on top of the tissue box.", null],
  [32, "success", 13.8, 0.59, "Put the green packet inside the plastic bowl", null],
  [35, "success", 19.8, 0.89, "Put the towel on the bottle to the right", null],
  [39, "success", 45.6, 0.96, "Take two folded white cloths out of the white box on the left", null],
  [40, "success", 55.5, 0.9, "Put the objects on the table into the cardboard box", null],
  [42, "success", 22.1, 0.59, "Move the black remote control to the left", null],
  [45, "success", 19.5, 0.8, "Place the calculator on the coaster", null],
  [46, "success", 21.3, 0.64, "Place the small bottle on top of the air fryer", null],
  [47, "failure", 8.6, 0.77, null, "arm reaches toward a bottle beside a book"],
  [48, "failure", 15.3, 0.75, null, "arm picks an item near a red bowl among dishes"],
  [49, "failure", 10.8, 0.5, null, "arm grasps one of several cans/bottles"],
  [50, "success", 89.8, 1.0, "Put the towel on the table into the box", null],
  [51, "success", 11.7, 0.8, "Place the lid on the silver pot", null],
  [53, "success", 25.9, 0.8, "Pick up the computer mouse and put it in the microwave", null],
  [54, "success", 8.4, 0.81, "Put the marker inside the cup", null],
  [56, "success", 40.1, 0.96, "Pick up the white towel and put it in the basket , pick up the marker and put it in the cup, then, pick up the yellow towel and put it in the basket, and finally pick up the masking tape and put it in the cup", null],
  [58, "success", 14.2, 0.96, "Pick up the blue cup and put it in the pink cup", null],
  [59, "failure", 9.9, 0.73, null, "arm reaches into a wooden box with orange items"],
  [60, "success", 9.6, 0.54, "Put the green block in the bowl", null],
  [66, "success", 9.3, 0.88, "Put the orange toy into the wooden box", null],
  [69, "success", 26.7, 0.91, "Move the orange objects from the pullout table to the desk", null],
  [72, "success", 22.4, 0.96, "Lift the pink bowl and place it into the green bowl, pick up the yellow cup and place it into the stacked bowls, then place them on top of the microwave", null],
  [76, "failure", 11.4, 0.87, null, "arm grasps a clear object on a table"],
  [83, "failure", 6.1, 0.72, null, "arm picks a green object among colored cups/rings"],
  [85, "failure", 8.7, 0.42, null, "arm grasps an orange object among cups on a table"],
  [86, "failure", 5.7, 0.99, null, "arm moves to a toaster next to a red bowl"],
  [87, "failure", 38.2, 0.99, null, "arm carries an orange/brown stick-like object near a drawer unit"],
  [88, "success", 8.5, 0.85, "Put the silver lid on the stove", null],
  [89, "success", 12.4, 0.73, "Pick up one small bottle from the container and put it on the table.", null],
  [91, "success", 6.7, 0.57, "Put the yellow cube inside the blue cup", null],
  [96, "success", 22.5, 0.8, "Get the marker from the table and place it in the colorless cup", null],
  [97, "success", 38.5, 0.7, "Pick the two bottles on the stove and place them on the counter, then pick the cooking stick from the pot and place it on the stove", null],
  [98, "success", 74.7, 0.93, "Take the blocks out of the gift disappointed", null],
];

export const droid100: RawEpisode[] = rows.map(
  ([index, outcome, duration, maxGripper, instruction, note]) => ({
    index,
    outcome,
    duration,
    maxGripper,
    instruction,
    note,
  }),
);
