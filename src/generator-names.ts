import { StringGenerator } from "rot-js";
import { Game } from "./game";
import { TileSubType } from "./tile";

export class GeneratorNames {
  private nameGenerator: StringGenerator;
  private nameGenerators: { [key: string]: StringGenerator };

  constructor(private game: Game) {
    this.nameGenerators = {};
    this.nameGenerator = new StringGenerator({ words: true });
    this.nameGenerators[TileSubType.Animal] = new StringGenerator({
      words: true,
    });
    this.nameGenerators[TileSubType.Human] = new StringGenerator({
      words: true,
    });
    this.nameGenerators[TileSubType.Fish] = new StringGenerator({
      words: true,
    });
    this.nameGenerators[TileSubType.Bird] = new StringGenerator({
      words: true,
    });
    const exampleHumanNames = [
      "Brady",
      "Mario",
      "Luigi",
      "Jen",
      "Cassie",
      "Tyler",
      "Dave",
      "Judy",
      "Jude",
      "Juan",
      "Jermaine",
      "Kylie",
      "Adam",
      "Patrick",
      "Matt",
      "Celeste",
      "Arthur",
      "Jimmy",
      "Jill",
      "Jainie",
      "Brodie",
      "Guadaloupe",
      "Jasmine",
      "Jasper",
      "Jared",
      "Jesse",
      "Jenny",
      "Jill",
      "Jillian",
      "Amy",
      "Bill",
      "Zane",
      "Zack",
      "Zach",
      "Zachary",
      "Zara",
      "Zelda",
      "Zoe",
      "Homer",
    ];
    const exampleAnimalNames = [
      "Spot",
      "Rover",
      "Fido",
      "Rex",
      "Rexy",
      "Rexie",
      "Bimbo",
      "Firolais",
      "Mancha",
      "Gatito",
      "Fido",
      "Rocco",
      "Dona",
      "Donatello",
      "Mustache",
      "Fuzzy",
      "Bigote",
      "Fluffy",
      "Lanudo",
      "Paws",
      "Patas",
      "Pawsy",
      "Pawsie",
      "Pappas",
      "Pappie",
      "Zippy",
      "Skippy",
      "Skipper",
      "Skip",
      "Skunk",
      "Boots",
      "Bootsy",
      "Bootsie",
      "Bannana",
    ];
    const exampleFishNames = [
      "Bubbles",
      "Goldie",
      "Nemo",
      "Dory",
      "Gill",
      "Marlin",
      "Bruce",
      "Anchor",
      "Chum",
      "Bloat",
      "Jacques",
      "Nigel",
      "Crush",
      "Squirt",
      "Sheldon",
      "Shelder",
      "Tad",
      "Pearl",
      "Gurgle",
    ];
    const exampleBirdNames = [
      "Polly",
      "Pollyanna",
      "Pollywog",
      "Pollywanna",
      "PollywannaCracker",
      "Squawk",
      "Squawker",
      "Squawky",
      "Squawkee",
      "Squawko",
      "Flip",
      "Wing",
      "Boeing",
      "Falco",
      "Eagle",
      "Hawk",
      "Eggy",
      "Eggo",
      "Eggbert",
      "Eggie",
    ];
    exampleHumanNames.forEach((name) =>
      this.nameGenerators[TileSubType.Human].observe(name)
    );
    exampleAnimalNames.forEach((name) =>
      this.nameGenerators[TileSubType.Animal].observe(name)
    );
    exampleFishNames.forEach((name) =>
      this.nameGenerators[TileSubType.Fish].observe(name)
    );
    exampleBirdNames.forEach((name) =>
      this.nameGenerators[TileSubType.Bird].observe(name)
    );
  }

  public generate(subType: TileSubType): string {
    return this.nameGenerators[subType].generate();
  }
}
