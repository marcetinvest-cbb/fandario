// Opening board for Dario's Austin weekend. Admin can edit everything after launch.
export type SeedOption = [label: string, odds: number, blurb: string];
export type SeedMarket = { title: string; subtitle?: string; options: SeedOption[] };

export const SEED: SeedMarket[] = [
  {
    title: 'First Night Legend',
    options: [
      ['Marc', -300, "Arriving later, all juiced up, might get a drink on the plane, forgets to electrolyte up before drinking and before we know it he's in the zone. White wine is flowing at Perry's as well."],
      ['Nick', -150, 'Has been ready to go and chomping at the bit the last handful of months.'],
      ['Dean', 100, 'Might be due for an electric showing out of the gate. Might already be shirtless.'],
      ['Zach', 110, 'Recommended the little-person stripper O/U. Could be a sign.'],
      ['Jwills', 125, "Always wanted to go to Texas, can't wait, doesn't know what to do and turns into the First Night Legend."],
      ['Modak', 400, 'Dark horse. Still newly married, but might let it rip. Shoes could be off early.'],
      ['Field', 500, 'Anyone else.'],
    ],
  },
  {
    title: 'First One to Blow Up the Bathroom',
    options: [
      ['Mike', -500, 'I want this one.'],
      ['Jwills', -275, 'Gonna want to clean out the bowels to grub up and drink up this weekend, and/or Zyn shits.'],
      ['Dario', -150, 'Wants to christen the toilet for a great trip — and for the plumbing to last until we leave.'],
      ['Modak', -100, "Can't leave him off this list. Guy always has a chance to make an impact."],
      ['John', 150, 'Secret stealth bomber.'],
      ['Dean', 2500, 'Has his first beer.'],
      ['Field', 350, 'Anyone else.'],
    ],
  },
  {
    title: 'Blacks Out Night One',
    options: [
      ['Dario', -350, 'F it. Starts kick-setting and pass-rushing people.'],
      ['Marc', -225, "Stars could align if he's the First Night Legend. Wearing the no-show socks. Electric. Might hit a big leg on Thursday Night Football and the night takes off from there."],
      ['Dean', -115, "Demons emerge. Thinks he's at Parker House with Flip for Memorial Day weekend."],
      ['Nick', -100, "First one to start drinking and all in on the weekend. Let's go Nick!"],
      ['Mike', 100, 'Sometimes you have too many beers.'],
      ['Jay', 115, 'A couple days away from the kids. Could be time to let loose.'],
      ['Jwills', 150, "Has way too many old fashioneds at Perry's."],
      ['Field', 450, 'Anyone else.'],
    ],
  },
  {
    title: 'First One to Go Horns Down',
    options: [
      ['Marc', -150, 'Has been doing it the last three months.'],
      ['Nick', -100, 'Secretly rooting for Miss St. Still riding high after the Gators beat Texas.'],
      ['Modak', 100, 'Might turn heel and be all Miss St for the weekend. Also has a cowbell in his carry-on for the game.'],
      ['Field', 300, 'Anyone else.'],
    ],
  },
  {
    title: 'First One Down the Boat Slide',
    options: [
      ['Dario', -150, 'Blesses the slide for us.'],
      ['Marc', -100, 'Definitely a favorite — wants this one for the record books. Could play defense so nobody goes down before him.'],
      ['Zach', 100, 'There are two slides on the boat. Chooses to go down simultaneously with a little-person stripper.'],
      ['Jay', 100, 'Goes down the slide into a somersault cannonball and sets the tone for the day.'],
      ['Dean', 650, 'Goes down naked and has to be taken back to the dock by the water police.'],
      ['Field', 500, 'Anyone else.'],
    ],
  },
  {
    title: 'O/U 0.5 Little Person Stripper Appearance',
    options: [
      ['Over 0.5', 100, 'Little person shows up.'],
      ['Under 0.5', -120, 'Little person does not show up.'],
    ],
  },
  {
    title: 'First One to Call Vigs After the Playoff Win',
    options: [
      ['Dario', -300, 'Too many drinks in and an electric FaceTime call happens while Vigs is at the Outback.'],
      ['Marc', -100, 'Local neighborhood heroes with Vigs.'],
      ['Nick', 100, "Set up a call days ahead pretending it's a work call."],
      ['Mystery Caller', 150, 'Calls Vigs, no answer, so he calls Claudio instead to put Vigs on the phone.'],
      ['Field', 550, 'Anyone else.'],
    ],
  },
  {
    title: 'Most Likely to End Up on Campus at a Texas Party',
    options: [
      ['Nick', -250, 'He\'s back! Thinks he\'s back at Temple. "She smiled at me."'],
      ['Marc', -250, '"Yea Nick let\'s go tear this sh*t up." Also wants to go Horns Down at a party.'],
      ['Dean', -100, 'Has a Halloween costume ready to go.'],
      ['Mike', 100, "Halloween's over, it's Christmas time."],
      ['Jwills', 100, "Doesn't want the night to end."],
      ['Dario', 225, 'Just wants to see the night through.'],
      ['Modak', 450, '"Not sure how the wedding ring will look going on campus."'],
      ['Zach', 500, 'Wants to show everyone his Gruden impressions and snap counts.'],
      ['John', 600, 'Dark horse, but has had Halloween parties before.'],
      ['Field', 660, 'Anyone else.'],
    ],
  },
  {
    title: 'First One to Take a Nap',
    options: [
      ['John', -100, 'Heavy favorite according to Adam Schefter.'],
      ['Marc', 100, 'Always due for a quick snooze.'],
      ['Dean', 400, 'Dark horse — already got a shoulder/chest workout in before the flight and needs to get horizontal for 45 minutes. Then the demons emerge.'],
      ['Field', 450, 'Anyone else.'],
    ],
  },
  {
    title: "Most Likely Not to Wake Up in the BnB",
    options: [
      ['Mike', -150, 'Outside in the bushes.'],
      ['Nick', -100, 'Austin cougar.'],
      ['Marc & Jwills', 150, 'Missed the cab back.'],
      ['Jay', 200, 'Got going fiercely and was found asleep in the hot tub.'],
      ['Dario', 500, "Turns out Modak blew up the bathroom after 87 beers and Terry Black's on Friday, so Dario elected to sleep outside."],
      ['Field', 550, 'Anyone else.'],
    ],
  },
];
