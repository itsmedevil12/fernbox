// Allocates without bound: tests the hard heap limit.
let a = [];
while (true) {
  a.push(new Array(1000000));
}
