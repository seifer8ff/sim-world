import { StringGenerator } from "rot-js";
import { Game } from "./game";

export class GeneratorNames {
  private nameGenerator: StringGenerator;
  private nameGenerators: { [key: string]: StringGenerator };

  constructor(private game: Game) {
    this.nameGenerators = {};
    this.nameGenerator = new StringGenerator({ words: true });
    this.nameGenerators.animal = new StringGenerator({
      words: true,
    });
    this.nameGenerators.humanoid = new StringGenerator({
      words: true,
    });
    this.nameGenerators.aquatic = new StringGenerator({
      words: true,
    });
    this.nameGenerators.flying = new StringGenerator({
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
    const exampleAquaticNames = [
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
    const exampleFlyingNames = [
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
      this.nameGenerators.humanoid.observe(name)
    );
    exampleAnimalNames.forEach((name) =>
      this.nameGenerators.animal.observe(name)
    );
    exampleAquaticNames.forEach((name) =>
      this.nameGenerators.aquatic.observe(name)
    );
    exampleFlyingNames.forEach((name) =>
      this.nameGenerators.flying.observe(name)
    );
  }

  public generate(
    subType: "aquatic" | "humanoid" | "flying" | "animal"
  ): string {
    return this.nameGenerators[subType].generate();
  }
}
